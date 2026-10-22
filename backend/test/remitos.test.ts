/**
 * Pruebas de las REGLAS DE NEGOCIO de remitos a través de la API real (Supertest):
 * ajustes (saldo anterior, descuentos, vacíos devueltos) y entregas parciales.
 * Se usan documentos reales de Mongoose (con sus cálculos de total, entregado y saldo);
 * solo se reemplaza la persistencia (save / findById) por versiones en memoria.
 */
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import Remito from '../src/models/Remito';
import { reiniciarLimitadores } from '../src/middleware/rateLimiter';
import { conToken, iniciarSesionComo } from './ayudas';

const oid = () => new mongoose.Types.ObjectId();

/** Remito con un producto de $10.000 (total = 10.000), abierto o cerrado. */
const crearRemito = (estado: 'abierto' | 'cerrado' = 'abierto') => {
  const remito: any = new Remito({
    nombre_cliente: 'Jose',
    vendedor: oid(),
    estado,
    items: [{ producto: oid(), nombre_producto: 'Tomate', cantidad: 1, unidad_venta: 'bulto', bultos_consumidos: 1, precio_unitario: 10000, subtotal: 10000 }],
    total: 10000,
  });
  remito.save = jest.fn(async function (this: any) { return this; });
  jest.spyOn(Remito, 'findById').mockResolvedValue(remito);
  return remito;
};

let token: string;
let id: string;
beforeEach(() => {
  reiniciarLimitadores();
  token = iniciarSesionComo('vendedor'); // los tres roles pueden cargar ajustes y entregas
  id = oid().toString();
});

const ajuste = (cuerpo: object) => request(app).post(`/api/remitos/${id}/ajustes`).set(conToken(token)).send(cuerpo);
const entrega = (cuerpo: object) => request(app).post(`/api/remitos/${id}/entregas`).set(conToken(token)).send(cuerpo);

describe('Ajustes', () => {
  test('un saldo anterior suma al total', async () => {
    const remito = crearRemito();
    const r = await ajuste({ concepto: 'Saldo anterior', monto: 5000 });
    expect(r.status).toBe(201);
    expect(remito.total).toBe(15000);
    expect(remito.save).toHaveBeenCalled();
  });

  test('vacíos devueltos: 5 × $3.000 = ajuste de −$15.000 que reduce el total (hasta quedar en 0)', async () => {
    const remito = crearRemito();
    await ajuste({ concepto: 'Saldo anterior', monto: 10000 }); // total 20.000
    const r = await ajuste({ concepto: 'Vacíos devueltos (5 × $3.000)', monto: -15000, resaltado: true });
    expect(r.status).toBe(201);
    expect(remito.total).toBe(5000);
    expect(remito.ajustes[1].resaltado).toBe(true);
  });

    test('un ajuste que deja el total en negativo se acepta (saldo a favor del cliente)', async () => {
    const remito = crearRemito(); // total 10000
    const r = await ajuste({ concepto: 'Saldo a favor', monto: -10001 });
    expect(r.status).toBe(201);
    expect(remito.total).toBe(-1);
    expect(remito.saldo).toBe(-1); // sin entregas: saldo = total, negativo = a favor
  });

  test('con el remito cerrado no se pueden agregar ajustes', async () => {
    crearRemito('cerrado');
    expect((await ajuste({ concepto: 'x', monto: 100 })).status).toBe(400);
  });

  test.each([
    ['monto 0', { concepto: 'x', monto: 0 }],
    ['monto no numérico', { concepto: 'x', monto: 'abc' }],
    ['concepto vacío', { concepto: '   ', monto: 10 }],
    ['concepto con etiquetas HTML', { concepto: '<script>alert(1)</script>', monto: 10 }],
    ['concepto como objeto (inyección NoSQL)', { concepto: { $ne: 1 }, monto: 10 }],
    ['resaltado como texto en lugar de booleano', { concepto: 'x', monto: 10, resaltado: 'true' }],
  ])('entrada inválida rechazada con 400: %s', async (_nombre, cuerpo) => {
    const remito = crearRemito();
    expect((await ajuste(cuerpo)).status).toBe(400);
    expect(remito.save).not.toHaveBeenCalled();
  });

  test('un id de remito con formato inválido responde 400 (no llega a la base)', async () => {
    const r = await request(app).post('/api/remitos/no-es-un-id/ajustes').set(conToken(token)).send({ concepto: 'x', monto: 10 });
    expect(r.status).toBe(400);
  });

  test('quitar un ajuste recalcula el total', async () => {
    const remito = crearRemito();
    await ajuste({ concepto: 'Saldo anterior', monto: 5000 });
    const ajusteId = remito.ajustes[0]._id.toString();
    const r = await request(app).delete(`/api/remitos/${id}/ajustes/${ajusteId}`).set(conToken(token));
    expect(r.status).toBe(200);
    expect(remito.total).toBe(10000);
  });
});

describe('Entregas parciales', () => {
  test('una entrega parcial reduce el saldo', async () => {
    const remito = crearRemito();
    const r = await entrega({ monto: 4000, nota: 'Efectivo' });
    expect(r.status).toBe(201);
    expect(remito.entregado).toBe(4000);
    expect(remito.saldo).toBe(6000);
  });

    test('una entrega mayor al saldo se acepta: el excedente queda a favor del cliente', async () => {
    const remito = crearRemito(); // total 10000
    const r = await entrega({ monto: 10500 });
    expect(r.status).toBe(201);
    expect(remito.entregas).toHaveLength(1);
    expect(remito.saldo).toBe(-500); // saldo negativo = a favor del cliente
  });

  test('con el remito cerrado SÍ se aceptan entregas (el cliente suele pagar después)', async () => {
    crearRemito('cerrado');
    expect((await entrega({ monto: 2500 })).status).toBe(201);
  });

    test('con saldo cero o a favor se siguen aceptando entregas (el cliente va transfiriendo)', async () => {
    const remito = crearRemito();
    expect((await entrega({ monto: 10000 })).status).toBe(201);
    expect((await entrega({ monto: 1500 })).status).toBe(201);
    expect(remito.saldo).toBe(-1500);
  });

  test.each([
    ['monto 0', { monto: 0 }],
    ['monto negativo', { monto: -50 }],
    ['nota con etiquetas HTML', { monto: 10, nota: '<b>x</b>' }],
  ])('entrada inválida rechazada con 400: %s', async (_nombre, cuerpo) => {
    crearRemito();
    expect((await entrega(cuerpo)).status).toBe(400);
  });

  test('anular una entrega no la borra: queda marcada con quién y cuándo, y el saldo se recupera', async () => {
    const remito = crearRemito();
    await entrega({ monto: 4000 });
    const entregaId = remito.entregas[0]._id.toString();

    const r = await request(app).patch(`/api/remitos/${id}/entregas/${entregaId}/anular`).set(conToken(token));
    expect(r.status).toBe(200);
    expect(remito.entregas).toHaveLength(1); // sigue existiendo (rastro de auditoría)
    expect(remito.entregas[0].anulada).toBe(true);
    expect(remito.entregas[0].anulada_por).toBeDefined();
    expect(remito.entregas[0].anulada_fecha).toBeInstanceOf(Date);
    expect(remito.saldo).toBe(10000);
  });

  test('una entrega ya anulada no se puede anular de nuevo', async () => {
    const remito = crearRemito();
    await entrega({ monto: 4000 });
    const entregaId = remito.entregas[0]._id.toString();
    await request(app).patch(`/api/remitos/${id}/entregas/${entregaId}/anular`).set(conToken(token));
    const r = await request(app).patch(`/api/remitos/${id}/entregas/${entregaId}/anular`).set(conToken(token));
    expect(r.status).toBe(400);
  });
});

describe('Acceso', () => {
  test('sin sesión no se pueden cargar entregas ni ajustes (401)', async () => {
    crearRemito();
    expect((await request(app).post(`/api/remitos/${id}/entregas`).send({ monto: 10 })).status).toBe(401);
    expect((await request(app).post(`/api/remitos/${id}/ajustes`).send({ concepto: 'x', monto: 10 })).status).toBe(401);
  });
});
