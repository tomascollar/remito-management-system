/**
 * Pruebas de SEGURIDAD de la API, de punta a punta con Supertest: autenticación (JWT),
 * control de acceso por rol (RBAC), login sin filtración de información, límite de intentos,
 * validación de entrada y cabeceras. Se ejecutan contra la app real (src/app.ts); solo se
 * simula el acceso a la base de datos.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../src/app';
import User from '../src/models/User';
import { reiniciarLimitadores } from '../src/middleware/rateLimiter';
import { limpiarEventos, listarEventos } from '../src/security/eventosSeguridad';
import { conToken, iniciarSesionComo, nuevoId, tokenDe } from './ayudas';

beforeEach(() => {
  reiniciarLimitadores(); // cada test parte con el cupo de intentos en cero
  limpiarEventos();
});

describe('Autenticación con JWT', () => {
  test('una ruta protegida sin token responde 401', async () => {
    const r = await request(app).get('/api/remitos');
    expect(r.status).toBe(401);
  });

  test('un token firmado con OTRO secreto es rechazado (401)', async () => {
    const falso = jwt.sign({ id: nuevoId(), rol: 'superadmin' }, 'otro-secreto-de-un-atacante');
    const r = await request(app).get('/api/users').set(conToken(falso));
    expect(r.status).toBe(401);
  });

  test('un token con algoritmo "none" (sin firma) es rechazado', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const sinFirma = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: nuevoId(), rol: 'superadmin' })}.`;
    const r = await request(app).get('/api/users').set(conToken(sinFirma));
    expect(r.status).toBe(401);
  });

  test('un token vencido responde 401 y queda registrado como "token_expirado"', async () => {
    const vencido = tokenDe(nuevoId(), 'vendedor', { expiresIn: -10 });
    const r = await request(app).get('/api/remitos').set(conToken(vencido));
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/expirado/i);
    expect(listarEventos().some((e) => e.tipo === 'token_expirado')).toBe(true);
  });

  test('un usuario desactivado no puede usar un token todavía válido', async () => {
    const token = iniciarSesionComo('vendedor', { activo: false });
    const r = await request(app).get('/api/remitos').set(conToken(token));
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/inactivo/i);
  });
});

describe('Control de acceso por rol (RBAC)', () => {
  test.each(['vendedor', 'administrador'] as const)('el rol %s NO puede gestionar usuarios (403)', async (rol) => {
    const token = iniciarSesionComo(rol);
    const r = await request(app).get('/api/users').set(conToken(token));
    expect(r.status).toBe(403);
    expect(listarEventos().some((e) => e.tipo === 'acceso_denegado')).toBe(true);
  });

  test('el superadmin sí puede listar usuarios', async () => {
    const token = iniciarSesionComo('superadmin');
    jest.spyOn(User, 'find').mockReturnValue({ select: async () => [] } as any);
    const r = await request(app).get('/api/users').set(conToken(token));
    expect(r.status).toBe(200);
  });

  test('no existe registro público de usuarios (no se puede autoasignar un rol)', async () => {
    const r = await request(app).post('/api/auth/register').send({ nombre: 'X', email: 'x@x.com', password: 'Clave12345', rol: 'superadmin' });
    expect(r.status).toBe(404);
  });
});

describe('Login', () => {
  const hash = bcrypt.hashSync('ClaveCorrecta1', 10);
  const cuenta = { _id: nuevoId(), nombre: 'Ana', email: 'ana@x.com', rol: 'vendedor', activo: true, password: hash };
  const login = (email: unknown, password: unknown) => request(app).post('/api/auth/login').send({ email, password });

  beforeEach(() => {
    jest.spyOn(User, 'findOne').mockImplementation((async (f: any) => (f.email === cuenta.email ? cuenta : null)) as any);
  });

  test('credenciales correctas → 200 con token y sin devolver la contraseña', async () => {
    const r = await login('ana@x.com', 'ClaveCorrecta1');
    expect(r.status).toBe(200);
    expect(r.body.token).toEqual(expect.any(String));
    expect(JSON.stringify(r.body)).not.toContain(hash);
  });

  test('email inexistente y contraseña errónea dan la MISMA respuesta (no revelan qué cuentas existen)', async () => {
    const a = await login('noexiste@x.com', 'cualquiera1');
    const b = await login('ana@x.com', 'incorrecta1');
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
    expect(a.body).toEqual(b.body);
  });

  test('un operador NoSQL en lugar del email ({"$ne": null}) es rechazado por validación', async () => {
    const r = await login({ $ne: null }, 'ClaveCorrecta1');
    expect(r.status).toBe(400);
  });

  test('tras 5 intentos fallidos, el siguiente responde 429 y queda registrado el bloqueo', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login('ana@x.com', 'incorrecta1')).status).toBe(400);
    }
    const r = await login('ana@x.com', 'incorrecta1');
    expect(r.status).toBe(429);
    expect(listarEventos().some((e) => e.tipo === 'login_bloqueado')).toBe(true);
  });

  test('los logins correctos no gastan el cupo de intentos', async () => {
    for (let i = 0; i < 8; i++) {
      expect((await login('ana@x.com', 'ClaveCorrecta1')).status).toBe(200);
    }
  });
});

describe('Cabeceras y errores', () => {
  test('no se anuncia la tecnología del servidor (sin X-Powered-By) y hay política de contenido', async () => {
    const r = await request(app).get('/api/ruta-inexistente');
    expect(r.status).toBe(404);
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['content-security-policy']).toBeDefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  test('un cuerpo JSON mal formado responde 400 sin exponer detalles internos', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).not.toMatch(/at .*\.ts|node_modules/);
  });

  test('un cuerpo demasiado grande se rechaza (413)', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'a@a.com', password: 'x'.repeat(200_000) });
    expect(r.status).toBe(413);
  });
});
