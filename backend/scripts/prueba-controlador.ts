// Prueba los controladores REALES de remitos con documentos reales de Mongoose,
// reemplazando solo la persistencia (find/save) por versiones en memoria.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Remito from '../src/models/Remito';
import Product from '../src/models/Product';
import StockDiario from '../src/models/StockDiario';
import { agregarItem, modificarCantidadItem, quitarItem, cerrarRemito, reabrirRemito } from '../src/controllers/remitoController';

const oid = () => new mongoose.Types.ObjectId();
const repolloId = oid();
const papaId = oid();

const repollo: any = new Product({ nombre: 'Repollo', unidad_stock: 'Cajón', permite_venta_fraccionada: true, activo: true });
repollo._id = repolloId;
const papa: any = new Product({ nombre: 'Papa', unidad_stock: 'Bolsa', permite_venta_fraccionada: false, activo: true });
papa._id = papaId;
const stockRepollo: any = new StockDiario({ producto: repolloId, cantidad_bultos_inicial: 10, cantidad_bultos_actual: 10, precio_bulto: 12000, precio_unidad: 700, activo: true });
const stockPapa: any = new StockDiario({ producto: papaId, cantidad_bultos_inicial: 5, cantidad_bultos_actual: 5, precio_bulto: 8000, activo: true });
let remito: any;
let guardados = 0;

const persistir = (doc: any) => { doc.save = async function () { guardados++; return this; }; return doc; };
persistir(stockRepollo); persistir(stockPapa);
const nuevoRemito = () => { remito = persistir(new Remito({ nombre_cliente: 'Cliente', items: [], total: 0, vendedor: oid(), estado: 'abierto' })); };

(Product as any).findById = async (id: any) => [repollo, papa].find((p) => p._id.toString() === id.toString()) ?? null;
(StockDiario as any).findOne = async (f: any) => [stockRepollo, stockPapa].find((s) => s.producto.toString() === f.producto.toString()) ?? null;
(Remito as any).findById = async () => remito;

const llamar = async (fn: any, params: any, body: any = {}) => {
  const res: any = { code: 200, body: null, status(c: number) { this.code = c; return this; }, json(b: any) { this.body = b; return this; } };
  await fn({ params, body } as any, res);
  return res;
};
const stk = (s: any) => s.cantidad_bultos_actual;
const lineas = () => remito.items.length;

let n = 0;
const ok = (nombre: string) => console.log(`  ✔ ${nombre}`) || n++;

(async () => {
  nuevoRemito();

  // --- Fusión de líneas ---
  let r = await llamar(agregarItem, { id: 'r' }, { producto: repolloId, cantidad: 2, unidad_venta: 'bulto' });
  assert.equal(r.code, 201); assert.equal(lineas(), 1); assert.equal(stk(stockRepollo), 8);
  ok('agregar 2 bultos: una línea y stock 8');

  r = await llamar(agregarItem, { id: 'r' }, { producto: repolloId, cantidad: '1', unidad_venta: 'bulto' }); // cantidad como texto
  assert.equal(lineas(), 1, 'debe sumarse a la línea existente');
  assert.equal(remito.items[0].cantidad, 3); assert.equal(remito.items[0].bultos_consumidos, 3);
  assert.equal(remito.items[0].subtotal, 36000); assert.equal(remito.total, 36000); assert.equal(stk(stockRepollo), 7);
  ok('agregar 1 bulto más del mismo producto: se suma a la línea (3 bultos, $36.000, stock 7)');

  stockRepollo.precio_bulto = 13000; // el precio cambia durante el día
  await llamar(agregarItem, { id: 'r' }, { producto: repolloId, cantidad: 1, unidad_venta: 'bulto' });
  assert.equal(lineas(), 2, 'con otro precio debe ir en otra línea');
  assert.equal(remito.items[0].precio_unitario, 12000); assert.equal(remito.items[1].precio_unitario, 13000);
  assert.equal(remito.total, 36000 + 13000); assert.equal(stk(stockRepollo), 6);
  ok('con precio distinto va en otra línea y lo ya vendido conserva su precio');
  stockRepollo.precio_bulto = 12000;

  await llamar(agregarItem, { id: 'r' }, { producto: repolloId, cantidad: 25, unidad_venta: 'unidad' });
  assert.equal(lineas(), 3); assert.equal(stk(stockRepollo), 6, 'unidades no tocan stock');
  await llamar(agregarItem, { id: 'r' }, { producto: repolloId, cantidad: 5, unidad_venta: 'unidad' });
  const unidades = remito.items[2];
  assert.equal(lineas(), 3); assert.equal(unidades.cantidad, 30); assert.equal(unidades.bultos_consumidos, 0);
  assert.equal(unidades.subtotal, 21000); assert.equal(stk(stockRepollo), 6);
  ok('unidades: se fusionan (30 u., $21.000) y no tocan el stock');

  // --- Modificar cantidad ---
  const itemBulto = remito.items[0]; // 3 bultos a $12.000, stock 6
  r = await llamar(modificarCantidadItem, { id: 'r', itemId: itemBulto._id.toString() }, { cantidad: 5 });
  assert.equal(r.code, 200); assert.equal(itemBulto.cantidad, 5); assert.equal(itemBulto.bultos_consumidos, 5);
  assert.equal(itemBulto.subtotal, 60000); assert.equal(stk(stockRepollo), 4);
  assert.equal(remito.total, 60000 + 13000 + 21000);
  ok('subir de 3 a 5 bultos: descuenta 2 más (stock 4), subtotal y total recalculados');

  r = await llamar(modificarCantidadItem, { id: 'r', itemId: itemBulto._id.toString() }, { cantidad: 1 });
  assert.equal(itemBulto.cantidad, 1); assert.equal(stk(stockRepollo), 8); assert.equal(itemBulto.subtotal, 12000);
  ok('bajar de 5 a 1: devuelve 4 bultos (stock 8)');

  r = await llamar(modificarCantidadItem, { id: 'r', itemId: itemBulto._id.toString() }, { cantidad: 100 });
  assert.equal(r.code, 400); assert.equal(itemBulto.cantidad, 1); assert.equal(stk(stockRepollo), 8);
  ok('pedir más de lo que hay → 400 y no cambia nada');

  r = await llamar(modificarCantidadItem, { id: 'r', itemId: itemBulto._id.toString() }, { cantidad: 1.5 });
  assert.equal(itemBulto.cantidad, 1.5); assert.equal(stk(stockRepollo), 7.5);
  ok('admite medio bulto (1,5): stock 7,5');

  r = await llamar(modificarCantidadItem, { id: 'r', itemId: unidades._id.toString() }, { cantidad: 10 });
  assert.equal(unidades.cantidad, 10); assert.equal(unidades.subtotal, 7000); assert.equal(stk(stockRepollo), 7.5);
  ok('cambiar unidades (30 → 10): subtotal $7.000 y el stock no se toca');

  r = await llamar(modificarCantidadItem, { id: 'r', itemId: oid().toString() }, { cantidad: 2 });
  assert.equal(r.code, 404);
  ok('ítem inexistente → 404');

  // --- Quitar, cerrar, vacíos ---
  const antes = stk(stockRepollo);
  await llamar(quitarItem, { id: 'r', itemId: itemBulto._id.toString() });
  assert.equal(stk(stockRepollo), antes + 1.5);
  ok('quitar un ítem editado devuelve exactamente lo que consumía (1,5 bultos)');

  nuevoRemito();
  r = await llamar(cerrarRemito, { id: 'r' });
  assert.equal(r.code, 200); assert.equal(remito.estado, 'cerrado');
  ok('un remito vacío se puede cerrar');
  r = await llamar(modificarCantidadItem, { id: 'r', itemId: oid().toString() }, { cantidad: 1 });
  assert.equal(r.code, 400);
  ok('en un remito cerrado no se puede modificar (400)');
  await llamar(reabrirRemito, { id: 'r' });
  assert.equal(remito.estado, 'abierto');
  ok('reabrir funciona');

  console.log(`\n${n} verificaciones OK`);
})().catch((e) => { console.error('\n✘ FALLÓ:', e.message); process.exit(1); });
