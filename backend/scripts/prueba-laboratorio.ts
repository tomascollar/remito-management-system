/**
 * Prueba del Laboratorio de seguridad con el código REAL (rutas, middlewares, limitadores,
 * JWT) levantando un servidor Express en un puerto libre. Solo se reemplaza el acceso a
 * MongoDB (User.findById). No necesita base de datos.
 *
 * Uso (desde backend):  npx tsx scripts/prueba-laboratorio.ts
 */
import './entorno-prueba'; // debe ir primero: define JWT_SECRET antes de cargar el backend
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/models/User';
import { limiteGeneral, limiteLogin, reiniciarLimitadores } from '../src/middleware/rateLimiter';
import { verificarToken } from '../src/middleware/authMiddleware';
import securityLabRoutes from '../src/routes/securityLabRoutes';
import { listarEventos, limpiarEventos, registrarEvento } from '../src/security/eventosSeguridad';
import { getConfig, restaurarConfig, setConfig } from '../src/security/securityConfig';

let ok = 0;
const prueba = async (nombre: string, fn: () => void | Promise<void>) => {
  await fn();
  console.log(`  ✔ ${nombre}`);
  ok++;
};
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Usuarios simulados (en lugar de MongoDB) ---
const usuarios: Record<string, { activo: boolean; rol: string }> = {
  sa: { activo: true, rol: 'superadmin' },
  vend: { activo: true, rol: 'vendedor' },
};
(User as any).findById = (id: string) => ({ select: async () => usuarios[id] ?? null });
const tokenDe = (id: string, expiresIn: number | string = '1h') => jwt.sign({ id, rol: usuarios[id].rol }, process.env.JWT_SECRET!, { expiresIn: expiresIn as any });

// --- App de prueba: lab (antes del limitador general), un login que siempre falla y una ruta protegida ---
const app = express();
app.use(express.json());
app.use('/api/security-lab', securityLabRoutes);
app.use(limiteGeneral);
app.post('/api/auth/login', limiteLogin, (_req, res) => {
  res.status(400).json({ message: 'Credenciales inválidas' });
});
app.get('/api/auth/profile', verificarToken, (_req, res) => res.json({ ok: true }));
const servidor = app.listen(0);
const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;

const llamar = async (metodo: string, ruta: string, { token, body }: { token?: string; body?: unknown } = {}) => {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => null), headers: r.headers };
};
const intentarLogin = () => llamar('POST', '/auth/login', { body: { email: 'x@x.com', password: 'mala' } });
const SA = tokenDe('sa');

(async () => {
  console.log('Acceso al laboratorio');
  await prueba('sin token → 401', async () => assert.equal((await llamar('GET', '/security-lab/estado')).status, 401));
  await prueba('vendedor → 403 y queda registrado como acceso_denegado', async () => {
    limpiarEventos();
    assert.equal((await llamar('GET', '/security-lab/estado', { token: tokenDe('vend') })).status, 403);
    assert.equal(listarEventos({ tipo: 'acceso_denegado' }).length, 1);
  });
  await prueba('superadmin → 200 con configuración, valores por defecto y rangos', async () => {
    const r = await llamar('GET', '/security-lab/estado', { token: SA });
    assert.equal(r.status, 200);
    assert.equal(r.data.config.loginMax, 5);
    assert.equal(r.data.config.jwtDuracionSeg, 28800);
    assert.deepEqual(r.data.limites.loginMax, [1, 1000]);
  });

  console.log('Fuerza bruta: el límite de intentos se cambia en vivo');
  await prueba('con límite 100, 70 intentos fallidos NO bloquean', async () => {
    let r = await llamar('PUT', '/security-lab/config', { token: SA, body: { loginMax: 100, loginVentanaSeg: 60 } });
    assert.equal(r.status, 200); assert.equal(r.data.config.loginMax, 100);
    for (let i = 0; i < 70; i++) assert.equal((await intentarLogin()).status, 400, `intento ${i + 1}`);
  });
  await prueba('con límite 5, el intento 6 se bloquea (429) y los anteriores no', async () => {
    await llamar('PUT', '/security-lab/config', { token: SA, body: { loginMax: 5 } });
    limpiarEventos();
    const estados: number[] = [];
    for (let i = 0; i < 7; i++) estados.push((await intentarLogin()).status);
    assert.deepEqual(estados, [400, 400, 400, 400, 400, 429, 429]);
  });
  await prueba('la respuesta informa el cupo restante (headers RateLimit-*)', async () => {
    await llamar('POST', '/security-lab/contadores/reiniciar', { token: SA });
    const r1 = await intentarLogin(); const r2 = await intentarLogin();
    assert.equal(r1.headers.get('ratelimit-limit'), '5');
    assert.equal(Number(r1.headers.get('ratelimit-remaining')), 4);
    assert.equal(Number(r2.headers.get('ratelimit-remaining')), 3);
  });
  await prueba('el bloqueo queda en el registro de eventos', async () => {
    for (let i = 0; i < 5; i++) await intentarLogin();
    const r = await llamar('GET', '/security-lab/eventos?tipo=login_bloqueado', { token: SA });
    assert.ok(r.data.eventos.length >= 1);
    assert.match(r.data.eventos[0].detalle, /Más de 5 intentos fallidos en 1 minuto/);
  });
  await prueba('"reiniciar contadores" desbloquea sin cambiar la configuración', async () => {
    assert.equal((await intentarLogin()).status, 429);
    await llamar('POST', '/security-lab/contadores/reiniciar', { token: SA });
    assert.equal((await intentarLogin()).status, 400);
    assert.equal(getConfig().loginMax, 5);
  });
  await prueba('el propio laboratorio sigue accesible aunque el login esté bloqueado', async () => {
    for (let i = 0; i < 10; i++) await intentarLogin();
    assert.equal((await llamar('GET', '/security-lab/estado', { token: SA })).status, 200);
  });
  await prueba('la ventana corta: pasado el tiempo el contador se libera', async () => {
    await llamar('PUT', '/security-lab/config', { token: SA, body: { loginMax: 2, loginVentanaSeg: 10 } });
    // No se espera 10 s reales: se verifica que la ventana configurada llegó al limitador
    const r = await intentarLogin();
    assert.equal(r.headers.get('ratelimit-limit'), '2');
    assert.match(String(r.headers.get('ratelimit-policy')), /w=10/);
  });

  console.log('Validación de parámetros');
  await prueba('valores fuera de rango o no numéricos → 400 y no cambian nada', async () => {
    const antes = getConfig();
    for (const body of [{ loginMax: 0 }, { loginMax: 5000 }, { jwtDuracionSeg: 5 }, { loginVentanaSeg: 'abc' }, { generalMax: -1 }]) {
      const r = await llamar('PUT', '/security-lab/config', { token: SA, body });
      assert.equal(r.status, 400, JSON.stringify(body));
    }
    assert.deepEqual(getConfig(), antes);
  });
  await prueba('el módulo de configuración rechaza valores inválidos aunque se lo llame directo', () => {
    assert.throws(() => setConfig({ loginMax: 0 }), RangeError);
    assert.throws(() => setConfig({ jwtDuracionSeg: 1.5 }), RangeError);
  });
  await prueba('restaurar vuelve a los valores por defecto', async () => {
    await llamar('POST', '/security-lab/config/restaurar', { token: SA });
    assert.deepEqual(getConfig(), { loginMax: 5, loginVentanaSeg: 900, generalMax: 10000, generalVentanaSeg: 900, jwtDuracionSeg: 28800 });
  });
  await prueba('los cambios de configuración quedan registrados con el detalle', async () => {
    await llamar('PUT', '/security-lab/config', { token: SA, body: { jwtDuracionSeg: 120 } });
    const e = listarEventos({ tipo: 'config_cambiada' })[0];
    assert.match(e.detalle, /jwtDuracionSeg: 28800 → 120/);
    assert.equal(e.usuario, 'sa');
    restaurarConfig(); reiniciarLimitadores();
  });

  console.log('Sesión: expiración del token');
  await prueba('token de demostración: se emite con la duración pedida', async () => {
    const r = await llamar('POST', '/security-lab/token-demo', { token: SA, body: { duracionSeg: 6 } });
    assert.equal(r.status, 200);
    assert.equal(r.data.duracionSeg, 6);
    assert.ok(r.data.venceEn - r.data.emitidoEn >= 5000 && r.data.venceEn - r.data.emitidoEn <= 6000);
  });
  await prueba('mientras está vigente el servidor lo acepta; al vencer lo rechaza con "Token expirado"', async () => {
    const corto = tokenDe('sa', 1);
    assert.equal((await llamar('GET', '/auth/profile', { token: corto })).status, 200);
    await dormir(2100);
    limpiarEventos();
    const r = await llamar('GET', '/auth/profile', { token: corto });
    assert.equal(r.status, 401);
    assert.match(r.data.message, /Token expirado/);
    assert.equal(listarEventos({ tipo: 'token_expirado' }).length, 1);
  });
  await prueba('un token con firma falsa se registra como inválido (no como expirado)', async () => {
    limpiarEventos();
    const falso = jwt.sign({ id: 'sa', rol: 'superadmin' }, 'otra-clave', { expiresIn: '1h' });
    const r = await llamar('GET', '/auth/profile', { token: falso });
    assert.equal(r.status, 401); assert.equal(r.data.message, 'Token inválido');
    assert.equal(listarEventos({ tipo: 'token_invalido' }).length, 1);
    assert.equal(listarEventos({ tipo: 'token_expirado' }).length, 0);
  });
  await prueba('un token de demostración distingue el rol: el vendedor no puede emitirlo', async () => {
    assert.equal((await llamar('POST', '/security-lab/token-demo', { token: tokenDe('vend'), body: {} })).status, 403);
  });

  console.log('bcrypt');
  await prueba('mayor costo → más tiempo (cada +1 duplica)', async () => {
    const t = async (costo: number) => (await llamar('POST', '/security-lab/bcrypt', { token: SA, body: { costo } })).data.ms as number;
    const bajo = await t(4); const alto = await t(10);
    assert.ok(alto > bajo * 4, `costo 4: ${bajo} ms, costo 10: ${alto} ms`);
  });
  await prueba('costo fuera de 4–14 → 400 (evita bloquear el servidor)', async () => {
    assert.equal((await llamar('POST', '/security-lab/bcrypt', { token: SA, body: { costo: 31 } })).status, 400);
    assert.equal((await llamar('POST', '/security-lab/bcrypt', { token: SA, body: { costo: 3 } })).status, 400);
  });

  console.log('Registro de eventos');
  await prueba('guarda como máximo 500 eventos (los más viejos se descartan)', () => {
    limpiarEventos();
    for (let i = 0; i < 700; i++) registrarEvento('login_fallido', { detalle: `intento ${i}` });
    const todos = listarEventos({ limite: 1000 });
    assert.equal(todos.length, 500);
    assert.equal(todos[0].detalle, 'intento 699');
  });
  await prueba('un detalle larguísimo (ej. un email de 10 000 caracteres) se recorta', () => {
    registrarEvento('login_fallido', { detalle: 'a'.repeat(10000) });
    assert.ok(listarEventos()[0].detalle.length <= 201);
  });
  await prueba('se pueden pedir solo los eventos nuevos (desde_id) y vaciar el registro', async () => {
    limpiarEventos();
    registrarEvento('login_ok', { detalle: 'uno' });
    const id = listarEventos()[0].id;
    registrarEvento('login_ok', { detalle: 'dos' });
    const r = await llamar('GET', `/security-lab/eventos?desde_id=${id}`, { token: SA });
    assert.deepEqual(r.data.eventos.map((e: any) => e.detalle), ['dos']);
    await llamar('DELETE', '/security-lab/eventos', { token: SA });
    assert.equal(listarEventos().length, 0);
  });
  await prueba('tipo de evento inválido → 400', async () => {
    assert.equal((await llamar('GET', '/security-lab/eventos?tipo=otro', { token: SA })).status, 400);
  });

  console.log('Matriz de permisos (derivada de las rutas reales)');
  await prueba('refleja lo que protege cada ruta', async () => {
    const { data } = await llamar('GET', '/security-lab/permisos', { token: SA });
    const fila = (m: string, r: string) => data.rutas.find((x: any) => x.metodo === m && x.ruta === r);
    assert.deepEqual(fila('POST', '/api/auth/login'), { metodo: 'POST', ruta: '/api/auth/login', requiereLogin: false, roles: null });
    assert.equal(fila('GET', '/api/auth/profile').requiereLogin, true);
    assert.deepEqual(fila('GET', '/api/users').roles, ['superadmin']);
    assert.deepEqual(fila('POST', '/api/stock-diario').roles, ['superadmin', 'administrador']);
    assert.equal(fila('GET', '/api/stock-diario').roles, null); // cualquiera con sesión
    assert.deepEqual(fila('GET', '/api/stock-diario/movimientos').roles, ['superadmin', 'administrador']);
    assert.ok(data.rutas.length > 20);
  });

  servidor.close();
  console.log(`\n${ok} pruebas OK`);
  process.exit(0);
})().catch((e) => { console.error('\n✘ FALLÓ:', e.message); servidor.close(); process.exit(1); });
