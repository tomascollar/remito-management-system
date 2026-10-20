/**
 * Pruebas de la COLA DE IMPRESIÓN del ticket, a través de la API real (Supertest).
 *
 * Qué se prueba: quién puede usar cada ruta (sesión de persona vs. clave del agente), que la
 * entrada se valide, el ciclo de vida de un trabajo y las defensas (clave en tiempo constante,
 * límite de intentos, tamaño del cuerpo). La persistencia (Mongoose) se simula: lo que se verifica
 * de la base es QUÉ se le pide (filtros y actualizaciones), no cómo la ejecuta MongoDB.
 */
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import User from '../src/models/User';
import TrabajoImpresion from '../src/models/TrabajoImpresion';
import { claveValida } from '../src/middleware/agenteMiddleware';
import { reiniciarLimitadores } from '../src/middleware/rateLimiter';
import { MARGEN_MS, reiniciarEstadoAgente } from '../src/services/estadoAgente';
import { conToken, nuevoId, tokenDe, type Rol } from './ayudas';

const CLAVE = process.env.IMPRESION_AGENTE_TOKEN as string;
const agente = { Authorization: `Bearer ${CLAVE}` };

/** Imagen de prueba: ancho × alto puntos, 1 bit por punto, en base64. */
const raster = (ancho = 576, alto = 10) => Buffer.alloc((ancho / 8) * alto, 0xaa).toString('base64');
const pedido = (o: object = {}) => ({ ancho: 576, alto: 10, datos: raster(576, 10), ...o });

/** Inicia sesión como un usuario con id conocido (para comprobar a quién pertenece un trabajo). */
const sesion = (rol: Rol, id = nuevoId()) => {
  jest.spyOn(User, 'findById').mockImplementation((() => ({ select: async () => ({ activo: true, rol }) })) as any);
  return { id, token: tokenDe(id, rol) };
};

/** El agente "se conecta": hace su consulta (sin trabajos pendientes). */
const conectarAgente = async () => {
  jest.spyOn(TrabajoImpresion, 'findOneAndUpdate').mockReturnValue({ select: async () => null } as any);
  await request(app).post('/api/impresion/agente/siguiente').set(agente).expect(204);
};

beforeEach(() => {
  reiniciarLimitadores();
  reiniciarEstadoAgente();
});
afterEach(() => jest.restoreAllMocks());

describe('seguridad del agente de impresión', () => {
  it('sin clave, con clave incorrecta o con un token de usuario: 401', async () => {
    const usuario = sesion('superadmin').token;
    await request(app).post('/api/impresion/agente/siguiente').expect(401);
    await request(app).post('/api/impresion/agente/siguiente').set({ Authorization: 'Bearer clave-equivocada-clave-equivocada-123' }).expect(401);
    await request(app).post('/api/impresion/agente/siguiente').set(conToken(usuario)).expect(401); // ni un superadmin sirve como agente
  });

  it('la clave del agente no abre ninguna ruta de personas', async () => {
    await request(app).get('/api/impresion/estado').set(agente).expect(401);
    await request(app).post('/api/impresion/trabajos').set(agente).send(pedido()).expect(401);
    await request(app).get('/api/remitos').set(agente).expect(401);
  });

  it('un usuario común no puede consultar la cola del agente ni informar resultados', async () => {
    const { token } = sesion('vendedor');
    await request(app).post('/api/impresion/agente/siguiente').set(conToken(token)).expect(401);
    await request(app).post(`/api/impresion/agente/trabajos/${nuevoId()}/resultado`).set(conToken(token)).send({ ok: true }).expect(401);
  });

  it('si la función no está configurada (sin clave) o la clave es corta, las rutas "no existen" (404)', async () => {
    const original = process.env.IMPRESION_AGENTE_TOKEN;
    try {
      delete process.env.IMPRESION_AGENTE_TOKEN;
      await request(app).post('/api/impresion/agente/siguiente').set(agente).expect(404);
      process.env.IMPRESION_AGENTE_TOKEN = 'corta';
      await request(app).post('/api/impresion/agente/siguiente').set({ Authorization: 'Bearer corta' }).expect(404);
    } finally {
      process.env.IMPRESION_AGENTE_TOKEN = original;
    }
  });

  it('la clave se compara por huella (tiempo constante): acepta la correcta y rechaza cualquier otra', () => {
    expect(claveValida(CLAVE, CLAVE)).toBe(true);
    expect(claveValida(CLAVE + 'x', CLAVE)).toBe(false);
    expect(claveValida(CLAVE.slice(0, -1), CLAVE)).toBe(false);
    expect(claveValida('', CLAVE)).toBe(false);
  });
});

describe('estado del agente', () => {
  it('desconectado hasta que consulta; conectado al consultar; vuelve a desconectado si se calla', async () => {
    const { token } = sesion('vendedor');
    const estado = () => request(app).get('/api/impresion/estado').set(conToken(token));

    expect((await estado().expect(200)).body.agente_conectado).toBe(false);

    await conectarAgente();
    expect((await estado().expect(200)).body.agente_conectado).toBe(true);

    const ahora = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(ahora + MARGEN_MS + 1000);
    expect((await estado().expect(200)).body.agente_conectado).toBe(false);
  });

  it('sin sesión: 401', async () => {
    await request(app).get('/api/impresion/estado').expect(401);
  });
});

describe('pedir imprimir (personas)', () => {
  it.each<Rol>(['vendedor', 'administrador', 'superadmin'])('un %s puede encolar un ticket y queda registrado quién lo pidió', async (rol) => {
    const { id, token } = sesion(rol);
    await conectarAgente();
    const crear = jest.spyOn(TrabajoImpresion, 'create').mockImplementation((async (d: any) => ({ _id: new mongoose.Types.ObjectId(), estado: 'pendiente', ...d })) as any);
    const remito = nuevoId();

    const antes = Date.now();
    const res = await request(app).post('/api/impresion/trabajos').set(conToken(token)).send(pedido({ remito })).expect(201);

    expect(res.body.estado).toBe('pendiente');
    const guardado = crear.mock.calls[0][0] as any;
    expect(String(guardado.usuario)).toBe(id);
    expect(String(guardado.remito)).toBe(remito);
    expect(guardado.ancho).toBe(576);
    expect(guardado.alto).toBe(10);
    expect(Buffer.isBuffer(guardado.datos)).toBe(true);
    expect(guardado.datos.length).toBe(72 * 10);
    // vence en ~5 minutos: no se imprime un ticket viejo
    expect(guardado.vence.getTime() - antes).toBeGreaterThan(4.9 * 60_000);
    expect(guardado.vence.getTime() - antes).toBeLessThan(5.1 * 60_000);
  });

  it('sin agente conectado se rechaza (503) y no se encola nada', async () => {
    const { token } = sesion('vendedor');
    const crear = jest.spyOn(TrabajoImpresion, 'create');
    const res = await request(app).post('/api/impresion/trabajos').set(conToken(token)).send(pedido()).expect(503);
    expect(res.body.agente_conectado).toBe(false);
    expect(crear).not.toHaveBeenCalled();
  });

    it('sin sesión: 401, aunque el cuerpo sea enorme (la sesión se verifica ANTES de leerlo)', async () => {
    const crear = jest.spyOn(TrabajoImpresion, 'create');
    await request(app).post('/api/impresion/trabajos').send(pedido()).expect(401);
    // El servidor responde 401 SIN leer el cuerpo y cierra la conexión. Según el sistema operativo, el cliente
    // alcanza a leer ese 401 o recibe la conexión cortada (ECONNRESET/EPIPE, frecuente en Windows). Ambos
    // resultados prueban lo mismo: el cuerpo enorme no se aceptó. Lo que NO puede pasar es que llegue a crear el trabajo.
    const resultado: any = await request(app).post('/api/impresion/trabajos').send({ datos: 'A'.repeat(500_000) }).then((r) => r, (e) => e);
    
        // (No se usa `instanceof Error`: dentro de Jest los errores de red vienen de otro contexto y esa comprobación da falso.)
    if (resultado?.code) expect(['ECONNRESET', 'EPIPE']).toContain(resultado.code);
    else expect(resultado.status).toBe(401);
    
    expect(crear).not.toHaveBeenCalled();
  });

  it.each([
    ['ancho 0', { ancho: 0 }],
    ['ancho no múltiplo de 8', { ancho: 575 }],
    ['ancho mayor al de la térmica (577)', { ancho: 577 }],
    ['ancho que no es número', { ancho: 'ancho' }],
    ['alto 0', { alto: 0 }],
    ['alto excesivo', { alto: 6001 }],
    ['imagen vacía', { datos: '' }],
    ['imagen con caracteres inválidos', { datos: '<script>alert(1)</script>' }],
    ['imagen que no es texto', { datos: { $gt: '' } }],
    ['remito con id inválido', { remito: 'no-es-un-id' }],
    ['imagen de otro tamaño que ancho × alto', { datos: raster(576, 9) }],
  ])('rechaza (400) y no encola: %s', async (_caso, cambio) => {
    const { token } = sesion('vendedor');
    await conectarAgente();
    const crear = jest.spyOn(TrabajoImpresion, 'create');
    await request(app).post('/api/impresion/trabajos').set(conToken(token)).send(pedido(cambio)).expect(400);
    expect(crear).not.toHaveBeenCalled();
  });

  it('un cuerpo mayor a 800 kb con sesión válida da 413', async () => {
    const { token } = sesion('vendedor');
    await conectarAgente();
    await request(app).post('/api/impresion/trabajos').set(conToken(token)).send({ datos: 'A'.repeat(900_000) }).expect(413);
  });

  it('el límite general de 100 kb sigue rigiendo en el resto de la API', async () => {
    const { token } = sesion('administrador');
    await request(app).post('/api/remitos').set(conToken(token)).send({ nombre_cliente: 'A'.repeat(150_000) }).expect(413);
  });
});

describe('consultar un trabajo (personas)', () => {
  const trabajo = (o: object = {}) => ({ _id: new mongoose.Types.ObjectId(), usuario: nuevoId(), estado: 'pendiente', vence: new Date(Date.now() + 60_000), ...o });

  it('quien lo pidió ve su estado', async () => {
    const { id, token } = sesion('vendedor');
    jest.spyOn(TrabajoImpresion, 'findById').mockResolvedValue(trabajo({ usuario: id, estado: 'impreso' }) as any);
    const res = await request(app).get(`/api/impresion/trabajos/${nuevoId()}`).set(conToken(token)).expect(200);
    expect(res.body.estado).toBe('impreso');
  });

  it('un vendedor no ve el trabajo de otro (403); un administrador sí', async () => {
    jest.spyOn(TrabajoImpresion, 'findById').mockResolvedValue(trabajo({ usuario: nuevoId() }) as any);
    await request(app).get(`/api/impresion/trabajos/${nuevoId()}`).set(conToken(sesion('vendedor').token)).expect(403);
    await request(app).get(`/api/impresion/trabajos/${nuevoId()}`).set(conToken(sesion('administrador').token)).expect(200);
  });

  it('inexistente: 404; id inválido: 400; sin sesión: 401', async () => {
    const { token } = sesion('vendedor');
    jest.spyOn(TrabajoImpresion, 'findById').mockResolvedValue(null);
    await request(app).get(`/api/impresion/trabajos/${nuevoId()}`).set(conToken(token)).expect(404);
    await request(app).get('/api/impresion/trabajos/no-es-un-id').set(conToken(token)).expect(400);
    await request(app).get(`/api/impresion/trabajos/${nuevoId()}`).expect(401);
  });

  it('un trabajo que nadie tomó a tiempo figura "vencido" y se cierra', async () => {
    const { id, token } = sesion('vendedor');
    jest.spyOn(TrabajoImpresion, 'findById').mockResolvedValue(trabajo({ usuario: id, vence: new Date(Date.now() - 1000) }) as any);
    const actualizar = jest.spyOn(TrabajoImpresion, 'updateOne').mockResolvedValue({} as any);
    const res = await request(app).get(`/api/impresion/trabajos/${nuevoId()}`).set(conToken(token)).expect(200);
    expect(res.body.estado).toBe('vencido');
    expect(actualizar).toHaveBeenCalledTimes(1);
    expect((actualizar.mock.calls[0][1] as any).$unset).toEqual({ datos: 1 }); // se borra la imagen
  });

  it('si el agente tomó el trabajo y nunca informó, el usuario ve un error (no espera para siempre)', async () => {
    const { id, token } = sesion('vendedor');
    jest.spyOn(TrabajoImpresion, 'findById').mockResolvedValue(trabajo({ usuario: id, estado: 'imprimiendo', tomadoEn: new Date(Date.now() - 120_000) }) as any);
    jest.spyOn(TrabajoImpresion, 'updateOne').mockResolvedValue({} as any);
    const res = await request(app).get(`/api/impresion/trabajos/${nuevoId()}`).set(conToken(token)).expect(200);
    expect(res.body.estado).toBe('error');
    expect(res.body.error).toMatch(/no confirmó/);
  });

  it('un trabajo imprimiéndose hace poco sigue "imprimiendo"', async () => {
    const { id, token } = sesion('vendedor');
    jest.spyOn(TrabajoImpresion, 'findById').mockResolvedValue(trabajo({ usuario: id, estado: 'imprimiendo', tomadoEn: new Date(Date.now() - 5000) }) as any);
    const res = await request(app).get(`/api/impresion/trabajos/${nuevoId()}`).set(conToken(token)).expect(200);
    expect(res.body.estado).toBe('imprimiendo');
  });
});

describe('el agente toma e informa trabajos', () => {
  it('sin trabajos pendientes responde 204', async () => {
    jest.spyOn(TrabajoImpresion, 'findOneAndUpdate').mockReturnValue({ select: async () => null } as any);
    await request(app).post('/api/impresion/agente/siguiente').set(agente).expect(204);
  });

  it('entrega la imagen y lo pide de forma ATÓMICA: más antiguo primero, solo pendientes vigentes o colgados con un reintento', async () => {
    const datos = Buffer.from(raster(576, 10), 'base64');
    const id = new mongoose.Types.ObjectId();
    const buscar = jest.spyOn(TrabajoImpresion, 'findOneAndUpdate').mockReturnValue({ select: async () => ({ _id: id, ancho: 576, alto: 10, datos }) } as any);

    const res = await request(app).post('/api/impresion/agente/siguiente').set(agente).expect(200);
    expect(res.body).toEqual({ id: String(id), ancho: 576, alto: 10, datos: datos.toString('base64') });

    const [filtro, cambio, opciones] = buscar.mock.calls[0] as any[];
    expect(filtro.$or).toHaveLength(2);
    expect(filtro.$or[0]).toMatchObject({ estado: 'pendiente' });
    expect(filtro.$or[0].vence.$gt).toBeInstanceOf(Date); // un ticket vencido nunca se entrega
    expect(filtro.$or[1]).toMatchObject({ estado: 'imprimiendo', intentos: { $lt: 2 } }); // un solo reintento
    expect(cambio.$set.estado).toBe('imprimiendo'); // se marca en la MISMA operación: sin impresiones dobles
    expect(cambio.$inc).toEqual({ intentos: 1 });
    expect(opciones).toMatchObject({ sort: { createdAt: 1 }, returnDocument: 'after' });
  });

  it('informa que se imprimió: pasa a "impreso" y se borra la imagen', async () => {
    const id = nuevoId();
    const cerrar = jest.spyOn(TrabajoImpresion, 'findOneAndUpdate').mockResolvedValue({ _id: id, estado: 'impreso' } as any);
    const res = await request(app).post(`/api/impresion/agente/trabajos/${id}/resultado`).set(agente).send({ ok: true }).expect(200);
    expect(res.body.estado).toBe('impreso');
    const [filtro, cambio] = cerrar.mock.calls[0] as any[];
    expect(filtro).toEqual({ _id: id, estado: 'imprimiendo' }); // solo si estaba en curso
    expect(cambio.$set.estado).toBe('impreso');
    expect(cambio.$unset).toMatchObject({ datos: 1 });
  });

  it('informa un error: queda el motivo (recortado a 200 caracteres) y se borra la imagen', async () => {
    const id = nuevoId();
    const cerrar = jest.spyOn(TrabajoImpresion, 'findOneAndUpdate').mockResolvedValue({ _id: id, estado: 'error' } as any);
    await request(app).post(`/api/impresion/agente/trabajos/${id}/resultado`).set(agente).send({ ok: false, error: 'La impresora no responde' }).expect(200);
    const [, cambio] = cerrar.mock.calls[0] as any[];
    expect(cambio.$set).toMatchObject({ estado: 'error', error: 'La impresora no responde' });
    expect(cambio.$unset).toEqual({ datos: 1 });

    await request(app).post(`/api/impresion/agente/trabajos/${id}/resultado`).set(agente).send({ ok: false, error: 'x'.repeat(201) }).expect(400);
  });

  it('no se puede "terminar" dos veces ni dar por impreso lo que no estaba en curso (404)', async () => {
    jest.spyOn(TrabajoImpresion, 'findOneAndUpdate').mockResolvedValue(null);
    await request(app).post(`/api/impresion/agente/trabajos/${nuevoId()}/resultado`).set(agente).send({ ok: true }).expect(404);
  });

  it.each([
    ['ok como texto', { ok: 'true' }],
    ['ok como objeto', { ok: { $ne: null } }],
    ['sin ok', {}],
  ])('rechaza (400): %s', async (_caso, cuerpo) => {
    const buscar = jest.spyOn(TrabajoImpresion, 'findOneAndUpdate');
    await request(app).post(`/api/impresion/agente/trabajos/${nuevoId()}/resultado`).set(agente).send(cuerpo).expect(400);
    expect(buscar).not.toHaveBeenCalled();
  });

  it('id de trabajo inválido: 400', async () => {
    await request(app).post('/api/impresion/agente/trabajos/no-es-un-id/resultado').set(agente).send({ ok: true }).expect(400);
  });
});

// IMPORTANTE: va ÚLTIMO. Estos intentos agotan el cupo de fallos de la IP de pruebas, y los
// limitadores del agente no se pueden reiniciar (a propósito: no son ajustables).
describe('fuerza bruta contra la clave del agente', () => {
  it('tras varios intentos fallidos la IP queda bloqueada (429), incluso con la clave correcta', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 30; i++) {
      const r = await request(app).post('/api/impresion/agente/siguiente').set({ Authorization: `Bearer intento-${i}-intento-${i}-intento-${i}-xx` });
      estados.push(r.status);
    }
    expect(estados).toContain(429);
    expect(estados[0]).toBe(401);

    jest.spyOn(TrabajoImpresion, 'findOneAndUpdate').mockReturnValue({ select: async () => null } as any);
    await request(app).post('/api/impresion/agente/siguiente').set(agente).expect(429);
  });
});
