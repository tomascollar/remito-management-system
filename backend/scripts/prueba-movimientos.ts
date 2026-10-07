/**
 * Prueba del historial de stock (getMovimientos + registrarMovimiento) con el código real.
 * No necesita base de datos: se reemplazan find/countDocuments/create por versiones en memoria.
 *
 * Uso (desde backend):  npx tsx scripts/prueba-movimientos.ts
 */
import assert from 'node:assert/strict';
import MovimientoStock from '../src/models/MovimientoStock';
import { armarFiltroMovimientos, getMovimientos } from '../src/controllers/movimientoStockController';
import { registrarMovimiento } from '../src/services/movimientosStock';

let ok = 0;
const prueba = async (nombre: string, fn: () => void | Promise<void>) => {
  await fn();
  console.log(`  ✔ ${nombre}`);
  ok++;
};

const TOTAL = 45;
const base = Array.from({ length: TOTAL }, (_, i) => ({ _id: `m${TOTAL - i}`, tipo: 'venta', cantidad_bultos: -1 }));
let ultima: any = {};
(MovimientoStock as any).find = (filtro: any) => {
  ultima = { filtro, populate: [] };
  const q: any = {
    populate: (campo: string) => (ultima.populate.push(campo), q),
    sort: (o: any) => ((ultima.sort = o), q),
    skip: (n: number) => ((ultima.skip = n), q),
    limit: (n: number) => ((ultima.limite = n), q),
    lean: async () => base.slice(ultima.skip, ultima.skip + ultima.limite),
  };
  return q;
};
(MovimientoStock as any).countDocuments = async () => TOTAL;

const pedir = async (query: Record<string, unknown>) => {
  let cuerpo: any; let codigo = 200;
  const res: any = { json: (b: any) => (cuerpo = b), status: (c: number) => ((codigo = c), res) };
  await getMovimientos({ query } as any, res);
  return { cuerpo, codigo };
};

(async () => {
  console.log('Historial de movimientos de stock');

  await prueba('por defecto: página 1, 20 por página, más nuevos primero', async () => {
    const { cuerpo } = await pedir({});
    assert.equal(cuerpo.movimientos.length, 20);
    assert.equal(cuerpo.total, 45); assert.equal(cuerpo.totalPaginas, 3);
    assert.deepEqual(ultima.sort, { fecha: -1, _id: -1 });
  });
  await prueba('trae nombre de producto, usuario y remito asociado', async () => {
    await pedir({});
    assert.deepEqual(ultima.populate, ['producto', 'usuario', 'remito']);
  });
  await prueba('paginado: la última página trae lo que queda; el límite se acota a 50', async () => {
    const { cuerpo } = await pedir({ pagina: '3' });
    assert.equal(cuerpo.movimientos.length, 5); assert.equal(ultima.skip, 40);
    await pedir({ limite: '9999' }); assert.equal(ultima.limite, 50);
    await pedir({ limite: 'abc', pagina: '-4' }); assert.equal(ultima.limite, 20); assert.equal(ultima.skip, 0);
  });
  await prueba('filtros: producto, usuario, tipo y rango de fechas', async () => {
    const f = armarFiltroMovimientos({ producto: 'p1', usuario: 'u1', tipo: 'ajuste', fecha_desde: '2026-10-01T03:00:00.000Z' });
    assert.equal(f.producto, 'p1'); assert.equal(f.usuario, 'u1'); assert.equal(f.tipo, 'ajuste');
    assert.ok(f.fecha.$gte instanceof Date); assert.equal(f.fecha.$lte, undefined);
    assert.deepEqual(armarFiltroMovimientos({}), {});
  });
  await prueba('si la base falla responde 500 con mensaje', async () => {
    const original = (MovimientoStock as any).countDocuments;
    (MovimientoStock as any).countDocuments = async () => { throw new Error('caída'); };
    const err = console.error; console.error = () => {};
    const { codigo, cuerpo } = await pedir({});
    console.error = err; (MovimientoStock as any).countDocuments = original;
    assert.equal(codigo, 500); assert.match(cuerpo.message, /historial de stock/);
  });

  console.log('Registro de movimientos');
  const guardados: any[] = [];
  (MovimientoStock as any).create = async (m: any) => { guardados.push(m); return m; };
  await prueba('registra con fecha y los datos recibidos', async () => {
    await registrarMovimiento({ producto: 'p1', tipo: 'venta', cantidad_bultos: -2, usuario: 'u1' });
    assert.equal(guardados.length, 1); assert.ok(guardados[0].fecha instanceof Date); assert.equal(guardados[0].cantidad_bultos, -2);
  });
  await prueba('un movimiento de 0 bultos no se registra', async () => {
    await registrarMovimiento({ producto: 'p1', tipo: 'ajuste', cantidad_bultos: 0, usuario: 'u1' });
    assert.equal(guardados.length, 1);
  });
  await prueba('si falla el guardado no lanza error (no frena la venta)', async () => {
    (MovimientoStock as any).create = async () => { throw new Error('caída'); };
    const err = console.error; console.error = () => {};
    await assert.doesNotReject(registrarMovimiento({ producto: 'p1', tipo: 'venta', cantidad_bultos: -1, usuario: 'u1' }));
    console.error = err;
  });

  console.log(`\n${ok} pruebas OK`);
})().catch((e) => { console.error('\n✘ FALLÓ:', e.message); process.exit(1); });
