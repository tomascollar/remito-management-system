// Prueba los cálculos, validadores y controladores de ENTREGAS y AJUSTES con documentos reales
// de Mongoose (solo se reemplaza la persistencia por versiones en memoria).
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Remito from '../src/models/Remito';
import { agregarItem, quitarItem } from '../src/controllers/remitoController';
import { agregarAjuste, quitarAjuste, registrarEntrega, anularEntrega } from '../src/controllers/remitoPagosController';
import { validarAgregarAjuste, validarRegistrarEntrega } from '../src/middleware/remitoValidators';
import { calcularTotal, estadoPago, redondear, totalEntregado } from '../src/services/cobranzas';
import Product from '../src/models/Product';
import StockDiario from '../src/models/StockDiario';
import MovimientoStock from '../src/models/MovimientoStock';

const oid = () => new mongoose.Types.ObjectId();
let n = 0;
const ok = (t: string) => console.log(`  ✔ ${t}`) || n++;

// --- Documento en memoria ---
const productoId = oid();
const tomate: any = new Product({ nombre: 'Tomate', unidad_stock: 'Bulto', permite_venta_fraccionada: false, activo: true });
tomate._id = productoId;
const stock: any = new StockDiario({ producto: productoId, cantidad_bultos_inicial: 500, cantidad_bultos_actual: 500, precio_bulto: 1000, activo: true });
stock.save = async function () { return this; };
let remito: any;
const nuevo = () => {
  remito = new Remito({ nombre_cliente: 'Jose', items: [], total: 0, vendedor: oid(), estado: 'abierto' });
  remito.save = async function () { return this; };
};
(Product as any).findById = async () => tomate;
(StockDiario as any).findOne = async () => stock;
(Remito as any).findById = async () => remito;
(MovimientoStock as any).create = async (m: any) => m;

const llamar = async (fn: any, params: any, body: any = {}) => {
  const res: any = { code: 200, body: null, status(c: number) { this.code = c; return this; }, json(b: any) { this.body = b; return this; } };
  await fn({ params, body, usuario: { id: oid().toString() } } as any, res);
  return res;
};
// Corre una cadena de validadores y devuelve los mensajes de error
const validar = async (cadena: any[], params: any, body: any) => {
  const req: any = { params, body, query: {}, headers: {}, cookies: {} };
  for (const v of cadena) await v.run(req);
  return validationResult(req).array().map((e: any) => e.msg as string);
};
const ID = oid().toString();

(async () => {
  // ---------- Cálculos puros ----------
  assert.equal(redondear(0.1 + 0.2), 0.3);
  assert.equal(calcularTotal([{ subtotal: 100 }, { subtotal: 50 }], [{ monto: 1000 }, { monto: -30 }]), 1120);
  assert.equal(calcularTotal(undefined, undefined), 0);
  assert.equal(totalEntregado([{ monto: 10 }, { monto: 5, anulada: true }, { monto: 2.5 }]), 12.5);
  assert.equal(estadoPago(100, 0), 'pendiente');
  assert.equal(estadoPago(100, 40), 'parcial');
  assert.equal(estadoPago(100, 100), 'pagado');
  assert.equal(estadoPago(0, 0), 'pendiente');
  ok('cálculos puros: redondeo, total con ajustes, entregado sin anuladas, estado de cobro');

  // ---------- Validadores ----------
  assert.deepEqual(await validar(validarAgregarAjuste, { id: ID }, { concepto: 'Saldo anterior', monto: 50000 }), []);
  assert.deepEqual(await validar(validarAgregarAjuste, { id: ID }, { concepto: 'Descuento', monto: -2500.5 }), []);
  assert.ok((await validar(validarAgregarAjuste, { id: ID }, { concepto: 'x', monto: 0 })).length > 0, 'monto 0');
  assert.deepEqual(await validar(validarAgregarAjuste, { id: ID }, { concepto: 'Vacíos devueltos', monto: -15000, resaltado: true }), []);
  assert.ok((await validar(validarAgregarAjuste, { id: ID }, { concepto: 'x', monto: 5, resaltado: 'true' })).length > 0, 'resaltado como texto');
  assert.ok((await validar(validarAgregarAjuste, { id: ID }, { concepto: 'x', monto: 5, resaltado: { $ne: 1 } })).length > 0, 'resaltado objeto');
  assert.ok((await validar(validarAgregarAjuste, { id: ID }, { concepto: '  ', monto: 10 })).length > 0, 'concepto vacío');
  assert.ok((await validar(validarAgregarAjuste, { id: ID }, { concepto: '<script>', monto: 10 })).length > 0, 'concepto con <');
  assert.ok((await validar(validarAgregarAjuste, { id: ID }, { concepto: 'a'.repeat(101), monto: 10 })).length > 0, 'concepto largo');
  assert.ok((await validar(validarAgregarAjuste, { id: ID }, { concepto: 'x', monto: 'abc' })).length > 0, 'monto texto');
  assert.ok((await validar(validarAgregarAjuste, { id: ID }, { concepto: { $ne: 1 }, monto: 5 })).length > 0, 'concepto objeto (NoSQL)');
  assert.ok((await validar(validarAgregarAjuste, { id: 'no-es-id' }, { concepto: 'x', monto: 5 })).length > 0, 'id inválido');
  ok('validador de ajustes: acepta positivo/negativo; acepta resaltado booleano; rechaza monto 0, resaltado no booleano, vacío, <, largo, texto, objeto e id inválido');

  assert.deepEqual(await validar(validarRegistrarEntrega, { id: ID }, { monto: 1000 }), []);
  assert.deepEqual(await validar(validarRegistrarEntrega, { id: ID }, { monto: 1000, nota: 'Efectivo' }), []);
  assert.deepEqual(await validar(validarRegistrarEntrega, { id: ID }, { monto: 1000, nota: '' }), []);
  assert.ok((await validar(validarRegistrarEntrega, { id: ID }, { monto: 0 })).length > 0, 'monto 0');
  assert.ok((await validar(validarRegistrarEntrega, { id: ID }, { monto: -5 })).length > 0, 'monto negativo');
  assert.ok((await validar(validarRegistrarEntrega, { id: ID }, { monto: 10, nota: '<b>' })).length > 0, 'nota con <');
  assert.ok((await validar(validarRegistrarEntrega, { id: ID }, { monto: 10, nota: ['a'] })).length > 0, 'nota arreglo');
  ok('validador de entregas: rechaza monto ≤ 0, nota con < o de tipo inválido');

  // ---------- Controladores ----------
  nuevo();
  await llamar(agregarItem, { id: 'r' }, { producto: productoId, cantidad: 3, unidad_venta: 'bulto' }); // 3000
  assert.equal(remito.total, 3000);

  let r = await llamar(agregarAjuste, { id: 'r' }, { concepto: 'Saldo anterior', monto: 1000 });
  assert.equal(r.code, 201); assert.equal(remito.total, 4000); assert.equal(remito.saldo, 4000); assert.equal(remito.entregado, 0);
  ok('ajuste "Saldo anterior" +1000: total 4000, saldo 4000');

  // el ajuste sobrevive a cambios en los productos
  await llamar(agregarItem, { id: 'r' }, { producto: productoId, cantidad: 1, unidad_venta: 'bulto' });
  assert.equal(remito.total, 5000);
  ok('al agregar productos el total sigue incluyendo el ajuste (5000)');

  r = await llamar(agregarAjuste, { id: 'r' }, { concepto: 'Descuento', monto: -200 });
  assert.equal(remito.total, 4800);
  r = await llamar(agregarAjuste, { id: 'r' }, { concepto: 'Enorme', monto: -99999 });
  assert.equal(r.code, 400); assert.equal(remito.total, 4800); assert.equal(remito.ajustes.length, 2);
  ok('un ajuste que dejaría el total negativo deja el total en 4800');

  // Vacíos devueltos: 5 vacíos a $300 = descuento resaltado de 1500
  r = await llamar(agregarAjuste, { id: 'r' }, { concepto: '5 vacíos devueltos', monto: -1500, resaltado: true });
  assert.equal(r.code, 201); assert.equal(remito.total, 3300);
  const vacios = remito.ajustes[remito.ajustes.length - 1];
  assert.equal(vacios.resaltado, true); assert.equal(vacios.monto, -1500);
  assert.equal(remito.ajustes[0].resaltado, false, 'por defecto no se resalta');
  r = await llamar(agregarAjuste, { id: 'r' }, { concepto: 'Otra', monto: 1, resaltado: 'true' });
  assert.equal(remito.ajustes[remito.ajustes.length - 1].resaltado, false, 'un valor que no es true literal no resalta');
  remito.ajustes.pull(remito.ajustes[remito.ajustes.length - 1]._id); remito.ajustes.pull(vacios._id); remito.total = 4800;
  ok('vacíos devueltos (−1500) resaltado: guarda la marca y descuenta del total; por defecto no resalta');

  // Entregas
  r = await llamar(registrarEntrega, { id: 'r' }, { monto: 1500, nota: 'Efectivo' });
  assert.equal(r.code, 201); assert.equal(remito.entregado, 1500); assert.equal(remito.saldo, 3300);
  r = await llamar(registrarEntrega, { id: 'r' }, { monto: '800.5' });
  assert.equal(remito.entregado, 2300.5); assert.equal(remito.saldo, 2499.5);
  ok('dos entregas (1500 y 800,50): entregado 2300,50 y saldo 2499,50');

  r = await llamar(registrarEntrega, { id: 'r' }, { monto: 99999 });
  assert.equal(r.code, 400); assert.equal(remito.entregas.length, 2);
  ok('una entrega mayor al saldo se rechaza');

  // Remito cerrado: no admite ajustes ni productos, pero sí entregas
  remito.estado = 'cerrado';
  r = await llamar(agregarAjuste, { id: 'r' }, { concepto: 'X', monto: 5 });
  assert.equal(r.code, 400);
  r = await llamar(quitarAjuste, { id: 'r', ajusteId: remito.ajustes[0]._id.toString() });
  assert.equal(r.code, 400);
  r = await llamar(registrarEntrega, { id: 'r' }, { monto: 499.5 });
  assert.equal(r.code, 201); assert.equal(remito.saldo, 2000);
  ok('con el remito cerrado: no se tocan ajustes, pero sí se registran entregas');

  // Anular
  const idEntrega = remito.entregas[1]._id.toString();
  r = await llamar(anularEntrega, { id: 'r', entregaId: idEntrega });
  assert.equal(r.code, 200);
  const e = remito.entregas[1];
  assert.equal(e.anulada, true); assert.ok(e.anulada_por); assert.ok(e.anulada_fecha);
  assert.equal(remito.entregado, 1999.5); assert.equal(remito.saldo, 2800.5);
  assert.equal(remito.entregas.length, 3, 'no se borra: queda el rastro');
  r = await llamar(anularEntrega, { id: 'r', entregaId: idEntrega });
  assert.equal(r.code, 400);
  r = await llamar(anularEntrega, { id: 'r', entregaId: oid().toString() });
  assert.equal(r.code, 404);
  ok('anular: queda marcada con quién y cuándo, deja de contar, no se puede anular dos veces');

  // Pagado completo
  r = await llamar(registrarEntrega, { id: 'r' }, { monto: 2800.5 });
  assert.equal(remito.saldo, 0);
  r = await llamar(registrarEntrega, { id: 'r' }, { monto: 1 });
  assert.equal(r.code, 400);
  ok('saldo en 0: no admite más entregas');

  // JSON expone entregado y saldo, sin alias id
  const json: any = remito.toJSON();
  assert.equal(json.saldo, 0); assert.equal(json.entregado, 4800); assert.equal(json.id, undefined);
  ok('toJSON incluye entregado y saldo calculados');

  // Quitar ajuste con remito abierto
  remito.estado = 'abierto';
  r = await llamar(quitarAjuste, { id: 'r', ajusteId: remito.ajustes[0]._id.toString() });
  assert.equal(r.code, 200); assert.equal(remito.total, 3800); assert.equal(remito.ajustes.length, 1);
  assert.equal(remito.saldo, -1000);
  ok('quitar ajuste recalcula el total (queda saldo negativo = a favor del cliente)');

  // Remito viejo sin los campos nuevos
  const viejo: any = new Remito({ nombre_cliente: 'Viejo', items: [], total: 700, vendedor: oid() });
  assert.equal(viejo.entregado, 0); assert.equal(viejo.saldo, 700); assert.deepEqual(viejo.ajustes.length, 0);
  ok('un remito sin entregas ni ajustes (anterior a esta función) sigue funcionando');

  // quitar producto conserva ajustes
  nuevo();
  await llamar(agregarItem, { id: 'r' }, { producto: productoId, cantidad: 2, unidad_venta: 'bulto' });
  await llamar(agregarAjuste, { id: 'r' }, { concepto: 'Saldo anterior', monto: 500 });
  await llamar(quitarItem, { id: 'r', itemId: remito.items[0]._id.toString() });
  assert.equal(remito.total, 500);
  ok('quitar un producto no pierde el ajuste (total 500)');

  console.log(`\n${n} bloques OK`);
})().catch((err) => { console.error('✘', err); process.exit(1); });
