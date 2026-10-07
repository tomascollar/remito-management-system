/**
 * Prueba del listado paginado de remitos (getRemitos) usando el controlador real.
 * No necesita base de datos: se reemplazan Remito.find y Remito.countDocuments por versiones
 * que registran con qué filtro, orden, salto y límite se las llamó, y devuelven datos de ejemplo.
 *
 * Uso (desde backend):  npx tsx scripts/prueba-listado.ts
 */
import assert from 'node:assert/strict';
import Remito from '../src/models/Remito';
import { armarFiltroRemitos, getRemitos, regexInsensible } from '../src/controllers/remitoListado';

let ok = 0;
const prueba = async (nombre: string, fn: () => void | Promise<void>) => {
  await fn();
  console.log(`  ✔ ${nombre}`);
  ok++;
};

// --- Simulación de la base ---
const TOTAL = 45;
const base = Array.from({ length: TOTAL }, (_, i) => ({
  _id: `id${TOTAL - i}`, numero_remito: TOTAL - i, nombre_cliente: `Cliente ${TOTAL - i}`, total: 1000, estado: 'cerrado',
  vendedor: { nombre: 'Ale' }, items: [{ producto: 'a' }, { producto: 'b' }, { producto: 'c' }],
}));
let ultima: any = {};
(Remito as any).find = (filtro: any) => {
  ultima = { filtro };
  const q: any = {
    select: (s: string) => ((ultima.select = s), q),
    populate: () => q,
    sort: (o: any) => ((ultima.sort = o), q),
    skip: (n: number) => ((ultima.skip = n), q),
    limit: (n: number) => ((ultima.limite = n), q),
    lean: async () => base.slice(ultima.skip, ultima.skip + ultima.limite),
  };
  return q;
};
(Remito as any).countDocuments = async () => TOTAL;

const pedir = async (query: Record<string, unknown>) => {
  let cuerpo: any; let codigo = 200;
  const res: any = { json: (b: any) => (cuerpo = b), status: (c: number) => ((codigo = c), res) };
  await getRemitos({ query } as any, res);
  return { cuerpo, codigo };
};

(async () => {
  console.log('Listado paginado de remitos');

  await prueba('por defecto: página 1, 20 por página, más nuevos primero', async () => {
    const { cuerpo } = await pedir({});
    assert.equal(cuerpo.remitos.length, 20);
    assert.equal(cuerpo.remitos[0].numero_remito, 45);
    assert.equal(cuerpo.pagina, 1); assert.equal(cuerpo.limite, 20);
    assert.equal(cuerpo.total, 45); assert.equal(cuerpo.totalPaginas, 3);
    assert.deepEqual(ultima.sort, { numero_remito: -1 });
  });
  await prueba('no devuelve el detalle de ítems, solo la cantidad', async () => {
    const { cuerpo } = await pedir({});
    assert.equal(cuerpo.remitos[0].items, undefined);
    assert.equal(cuerpo.remitos[0].cantidad_items, 3);
  });
  await prueba('la última página trae lo que queda', async () => {
    const { cuerpo } = await pedir({ pagina: '3' });
    assert.equal(cuerpo.remitos.length, 5);
    assert.equal(cuerpo.remitos[0].numero_remito, 5);
    assert.equal(ultima.skip, 40);
  });
  await prueba('el límite se acota a 50 y valores raros vuelven al mínimo/defecto', async () => {
    await pedir({ limite: '9999' }); assert.equal(ultima.limite, 50);
    await pedir({ limite: '0' }); assert.equal(ultima.limite, 20);
    await pedir({ limite: 'abc', pagina: '-4' }); assert.equal(ultima.limite, 20); assert.equal(ultima.skip, 0);
  });
  await prueba('filtros de estado, vendedor y fechas', async () => {
    await pedir({ estado: 'abierto', vendedor: 'u1', fecha_desde: '2026-10-01T03:00:00.000Z' });
    assert.equal(ultima.filtro.estado, 'abierto');
    assert.equal(ultima.filtro.vendedor, 'u1');
    assert.ok(ultima.filtro.fecha.$gte instanceof Date);
    assert.equal(ultima.filtro.fecha.$lte, undefined);
  });
  await prueba('búsqueda por texto: cliente, y también número si es un número', async () => {
    assert.equal(armarFiltroRemitos({ q: 'rosa' }).$or.length, 1);
    const f = armarFiltroRemitos({ q: '#12' });
    assert.equal(f.$or.length, 2);
    assert.deepEqual(f.$or[1], { numero_remito: 12 });
    assert.equal(armarFiltroRemitos({ q: '   ' }).$or, undefined);
  });
  await prueba('la búsqueda ignora mayúsculas y tildes', async () => {
    const r = regexInsensible('jose');
    assert.ok(r.test('José Pérez')); assert.ok(r.test('JOSE'));
    assert.ok(regexInsensible('nino').test('Niño'));
    assert.ok(regexInsensible('José').test('jose'));
  });
  await prueba('lo que escribe el usuario no se interpreta como regex', async () => {
    const r = regexInsensible('a.*(b');
    assert.ok(!r.test('axxxb'));
    assert.ok(r.test('a.*(b'));
    assert.doesNotThrow(() => regexInsensible('[[[\\'));
  });
  await prueba('si la base falla responde 500 con mensaje', async () => {
    const original = (Remito as any).countDocuments;
    (Remito as any).countDocuments = async () => { throw new Error('caída'); };
    const err = console.error; console.error = () => {};
    const { codigo, cuerpo } = await pedir({});
    console.error = err; (Remito as any).countDocuments = original;
    assert.equal(codigo, 500); assert.match(cuerpo.message, /Error al obtener remitos/);
  });

  console.log(`\n${ok} pruebas OK`);
})().catch((e) => { console.error('\n✘ FALLÓ:', e.message); process.exit(1); });
