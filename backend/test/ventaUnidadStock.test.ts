/**
 * Pruebas de la fase 2 de la venta por unidad: toda venta por unidad (precio común o P.UxB)
 * descuenta del stock la fracción de bulto equivalente (cantidad ÷ unidades por bulto), y
 * cambiar la cantidad o quitar la línea devuelve exactamente lo descontado.
 *
 * Ejemplo guía: remolacha, 10 por bulto, stock de 20 bultos. 11 unidades = 1,1 bultos.
 *
 * Se prueba a través de la API real (Supertest) con documentos reales de Mongoose; solo se
 * reemplaza la persistencia (findById / findOne / save / create) por versiones en memoria.
 */
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import Remito from '../src/models/Remito';
import Product from '../src/models/Product';
import StockDiario from '../src/models/StockDiario';
import MovimientoStock from '../src/models/MovimientoStock';
import { reiniciarLimitadores } from '../src/middleware/rateLimiter';
import { conToken, iniciarSesionComo } from './ayudas';

const oid = () => new mongoose.Types.ObjectId();

let token: string;
let remitoId: string;
let movimientos: jest.SpyInstance;

/** Remito abierto; `items` permite arrancar con líneas ya cargadas (por ejemplo, viejas). */
const crearRemito = (items: object[] = []) => {
  const remito: any = new Remito({ nombre_cliente: 'Jose', vendedor: oid(), estado: 'abierto', items, total: 0 });
  remito.save = jest.fn(async function (this: any) { return this; });
  jest.spyOn(Remito, 'findById').mockResolvedValue(remito);
  return remito;
};

/** Producto fraccionable (remolacha) y su stock. `contenido: null` = producto sin el dato. */
const crearProductoYStock = ({ contenido = 10 as number | null, stockActual = 20 } = {}) => {
  const producto: any = new Product({
    nombre: 'Remolacha', unidad_stock: 'cajón', permite_venta_fraccionada: true, cantidad_por_bulto: contenido ?? undefined,
  });
  const stock: any = new StockDiario({
    producto: producto._id,
    cantidad_bultos_inicial: 20,
    cantidad_bultos_actual: stockActual,
    precio_bulto: 12000,
    precio_unidad: 1500,
    precio_unidad_x_bulto: 1300,
  });
  stock.save = jest.fn(async function (this: any) { return this; });
  jest.spyOn(Product, 'findById').mockResolvedValue(producto);
  jest.spyOn(StockDiario, 'findOne').mockResolvedValue(stock);
  return { producto, stock };
};

/** Línea por unidad ya cargada, como la dejaría una venta de esta versión (con contenido guardado). */
const lineaUnidad = (producto: any, o: object = {}) => ({
  producto: producto._id, nombre_producto: 'Remolacha', cantidad: 11, unidad_venta: 'unidad',
  bultos_consumidos: 1.1, contenido_por_bulto: 10, precio_unitario: 1500, subtotal: 16500, ...o,
});

beforeEach(() => {
  reiniciarLimitadores();
  token = iniciarSesionComo('vendedor');
  remitoId = oid().toString();
  movimientos = jest.spyOn(MovimientoStock, 'create').mockResolvedValue({} as any);
});

const agregar = (cuerpo: object) =>
  request(app).post(`/api/remitos/${remitoId}/items`).set(conToken(token)).send({ producto: oid().toString(), ...cuerpo });
const cambiar = (itemId: string, cantidad: number) =>
  request(app).patch(`/api/remitos/${remitoId}/items/${itemId}`).set(conToken(token)).send({ cantidad });
const quitar = (itemId: string) =>
  request(app).delete(`/api/remitos/${remitoId}/items/${itemId}`).set(conToken(token));

describe('Agregar por unidad: descuenta stock', () => {
  test('11 unidades con 10 por bulto descuentan 1,1 bultos y dejan constancia en la línea', async () => {
    const remito = crearRemito();
    const { stock } = crearProductoYStock();
    await agregar({ cantidad: 11, unidad_venta: 'unidad' }).expect(201);
    expect(stock.cantidad_bultos_actual).toBe(18.9);
    expect(stock.save).toHaveBeenCalled();
    expect(remito.items[0].bultos_consumidos).toBe(1.1);
    expect(remito.items[0].contenido_por_bulto).toBe(10);
    expect(remito.items[0].subtotal).toBe(16500); // el precio no cambia: 11 × 1.500
  });

  test('con precio P.UxB descuenta igual', async () => {
    crearRemito();
    const { stock } = crearProductoYStock();
    await agregar({ cantidad: 11, unidad_venta: 'unidad', precio_x_bulto: true }).expect(201);
    expect(stock.cantidad_bultos_actual).toBe(18.9);
  });

  test('queda en el historial como una venta, con las unidades en la observación', async () => {
    crearRemito();
    crearProductoYStock();
    await agregar({ cantidad: 11, unidad_venta: 'unidad' }).expect(201);
    expect(movimientos).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'venta', cantidad_bultos: -1.1, observaciones: expect.stringContaining('(11 u.)') }),
    );
  });

  test('una unidad con 10 por bulto descuenta 0,1', async () => {
    crearRemito();
    const { stock } = crearProductoYStock();
    await agregar({ cantidad: 1, unidad_venta: 'unidad' }).expect(201);
    expect(stock.cantidad_bultos_actual).toBe(19.9);
  });

  test('la venta por bulto sigue descontando 1 a 1', async () => {
    const remito = crearRemito();
    const { stock } = crearProductoYStock();
    await agregar({ cantidad: 2, unidad_venta: 'bulto' }).expect(201);
    expect(stock.cantidad_bultos_actual).toBe(18);
    expect(remito.items[0].contenido_por_bulto).toBeUndefined();
  });

  test('las sumas repetidas no arrastran ruido de punto flotante (20 − 0,1 − 0,1 − 0,1 = 19,7)', async () => {
    const remito = crearRemito();
    const { stock } = crearProductoYStock();
    for (let i = 0; i < 3; i++) await agregar({ cantidad: 1, unidad_venta: 'unidad' }).expect(201);
    expect(stock.cantidad_bultos_actual).toBe(19.7);
    expect(remito.items).toHaveLength(1);
    expect(remito.items[0].bultos_consumidos).toBe(0.3);
  });

  test('dos cargas se fusionan en una línea y descuentan la suma', async () => {
    const remito = crearRemito();
    const { stock } = crearProductoYStock();
    await agregar({ cantidad: 11, unidad_venta: 'unidad' }).expect(201);
    await agregar({ cantidad: 4, unidad_venta: 'unidad' }).expect(201);
    expect(remito.items).toHaveLength(1);
    expect(remito.items[0].cantidad).toBe(15);
    expect(remito.items[0].bultos_consumidos).toBe(1.5);
    expect(stock.cantidad_bultos_actual).toBe(18.5);
  });

  test('si el contenido por bulto del producto cambió, la nueva venta va en otra línea', async () => {
    const remito = crearRemito();
    const { producto } = crearProductoYStock();
    await agregar({ cantidad: 10, unidad_venta: 'unidad' }).expect(201);
    producto.cantidad_por_bulto = 12;
    await agregar({ cantidad: 12, unidad_venta: 'unidad' }).expect(201);
    expect(remito.items).toHaveLength(2);
    expect(remito.items.map((i: any) => i.bultos_consumidos)).toEqual([1, 1]);
  });

  test('no se mezcla con una línea por unidad vieja (sin contenido, que no descontó stock)', async () => {
    const { producto } = crearProductoYStock();
    const remito = crearRemito([lineaUnidad(producto, { bultos_consumidos: 0, contenido_por_bulto: undefined })]);
    await agregar({ cantidad: 5, unidad_venta: 'unidad' }).expect(201);
    expect(remito.items).toHaveLength(2);
    expect(remito.items[0].bultos_consumidos).toBe(0);
    expect(remito.items[1].bultos_consumidos).toBe(0.5);
  });
});

describe('Agregar por unidad: controles', () => {
  test('sin stock suficiente se rechaza con 400 y no cambia nada', async () => {
    const remito = crearRemito();
    const { stock } = crearProductoYStock({ stockActual: 1 });
    const r = await agregar({ cantidad: 11, unidad_venta: 'unidad' }); // necesita 1,1 y hay 1
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/Stock insuficiente.*1 bultos.*1\.1/);
    expect(stock.cantidad_bultos_actual).toBe(1);
    expect(stock.save).not.toHaveBeenCalled();
    expect(remito.items).toHaveLength(0);
    expect(movimientos).not.toHaveBeenCalled();
  });

  test('se puede vender justo lo que hay (el stock queda en 0)', async () => {
    crearRemito();
    const { stock } = crearProductoYStock({ stockActual: 1 });
    await agregar({ cantidad: 10, unidad_venta: 'unidad' }).expect(201);
    expect(stock.cantidad_bultos_actual).toBe(0);
  });

  test('un producto sin unidades por bulto no se puede vender por unidad', async () => {
    const remito = crearRemito();
    const { stock } = crearProductoYStock({ contenido: null });
    const r = await agregar({ cantidad: 3, unidad_venta: 'unidad' });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/unidades por bulto/);
    expect(remito.items).toHaveLength(0);
    expect(stock.save).not.toHaveBeenCalled();
  });

  test('ese mismo producto sin dato sí se puede vender por bulto', async () => {
    crearRemito();
    crearProductoYStock({ contenido: null });
    await agregar({ cantidad: 1, unidad_venta: 'bulto' }).expect(201);
  });

  test('un error de precio no toca el stock', async () => {
    crearRemito();
    const { stock } = crearProductoYStock();
    stock.precio_unidad_x_bulto = undefined;
    await agregar({ cantidad: 11, unidad_venta: 'unidad', precio_x_bulto: true }).expect(400);
    expect(stock.cantidad_bultos_actual).toBe(20);
    expect(stock.save).not.toHaveBeenCalled();
  });
});

describe('Cambiar la cantidad de una línea por unidad', () => {
  test('subir de 11 a 15 unidades descuenta 0,4 más y lo registra como venta', async () => {
    const { producto, stock } = crearProductoYStock({ stockActual: 18.9 });
    const remito = crearRemito([lineaUnidad(producto)]);
    await cambiar(remito.items[0]._id.toString(), 15).expect(200);
    expect(stock.cantidad_bultos_actual).toBe(18.5);
    expect(remito.items[0].bultos_consumidos).toBe(1.5);
    expect(remito.items[0].subtotal).toBe(22500);
    expect(movimientos).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'venta', cantidad_bultos: -0.4 }));
  });

  test('bajar de 11 a 5 unidades devuelve 0,6 y lo registra como devolución', async () => {
    const { producto, stock } = crearProductoYStock({ stockActual: 18.9 });
    const remito = crearRemito([lineaUnidad(producto)]);
    await cambiar(remito.items[0]._id.toString(), 5).expect(200);
    expect(stock.cantidad_bultos_actual).toBe(19.5);
    expect(remito.items[0].bultos_consumidos).toBe(0.5);
    expect(movimientos).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'devolucion', cantidad_bultos: 0.6 }));
  });

  test('subir más de lo que hay se rechaza con 400 y no cambia nada', async () => {
    const { producto, stock } = crearProductoYStock({ stockActual: 0.2 });
    const remito = crearRemito([lineaUnidad(producto)]);
    const r = await cambiar(remito.items[0]._id.toString(), 15); // necesita 0,4 más y hay 0,2
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/Stock insuficiente/);
    expect(stock.cantidad_bultos_actual).toBe(0.2);
    expect(remito.items[0].cantidad).toBe(11);
    expect(remito.save).not.toHaveBeenCalled();
  });

  test('usa el contenido guardado en la línea, no el actual del producto', async () => {
    const { producto, stock } = crearProductoYStock({ stockActual: 18.9 });
    producto.cantidad_por_bulto = 12; // se editó el producto después de la venta
    const remito = crearRemito([lineaUnidad(producto)]); // vendida con 10 por bulto
    await cambiar(remito.items[0]._id.toString(), 20).expect(200);
    expect(remito.items[0].bultos_consumidos).toBe(2); // 20 ÷ 10, no 20 ÷ 12
    expect(stock.cantidad_bultos_actual).toBe(18);
  });

  test('una línea por unidad vieja (sin contenido) sigue sin mover stock', async () => {
    const { producto, stock } = crearProductoYStock();
    const remito = crearRemito([lineaUnidad(producto, { bultos_consumidos: 0, contenido_por_bulto: undefined })]);
    await cambiar(remito.items[0]._id.toString(), 30).expect(200);
    expect(stock.cantidad_bultos_actual).toBe(20);
    expect(stock.save).not.toHaveBeenCalled();
    expect(movimientos).not.toHaveBeenCalled();
    expect(remito.items[0].cantidad).toBe(30);
  });

  test('una línea por bulto sigue funcionando igual', async () => {
    const { producto, stock } = crearProductoYStock({ stockActual: 18 });
    const remito = crearRemito([
      { producto: producto._id, nombre_producto: 'Remolacha', cantidad: 2, unidad_venta: 'bulto', bultos_consumidos: 2, precio_unitario: 12000, subtotal: 24000 },
    ]);
    await cambiar(remito.items[0]._id.toString(), 3).expect(200);
    expect(stock.cantidad_bultos_actual).toBe(17);
    expect(remito.items[0].bultos_consumidos).toBe(3);
  });
});

describe('Quitar una línea por unidad', () => {
  test('devuelve exactamente los bultos descontados y lo registra como devolución', async () => {
    const { producto, stock } = crearProductoYStock({ stockActual: 18.9 });
    const remito = crearRemito([lineaUnidad(producto)]);
    await quitar(remito.items[0]._id.toString()).expect(200);
    expect(stock.cantidad_bultos_actual).toBe(20);
    expect(remito.items).toHaveLength(0);
    expect(movimientos).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'devolucion', cantidad_bultos: 1.1 }));
  });

  test('una línea por unidad vieja no devuelve nada ni deja movimiento', async () => {
    const { producto, stock } = crearProductoYStock();
    const remito = crearRemito([lineaUnidad(producto, { bultos_consumidos: 0, contenido_por_bulto: undefined })]);
    await quitar(remito.items[0]._id.toString()).expect(200);
    expect(stock.cantidad_bultos_actual).toBe(20);
    expect(movimientos).not.toHaveBeenCalled();
  });

  test('agregar y quitar deja el stock exactamente como estaba (también con 3 por bulto)', async () => {
    const remito = crearRemito();
    const { stock } = crearProductoYStock({ contenido: 3 });
    await agregar({ cantidad: 1, unidad_venta: 'unidad' }).expect(201); // 1 ÷ 3 = 0,333333
    expect(stock.cantidad_bultos_actual).toBe(19.666667);
    await quitar(remito.items[0]._id.toString()).expect(200);
    expect(stock.cantidad_bultos_actual).toBe(20);
  });
});

describe('Productos fraccionables: unidades por bulto obligatorias', () => {
  const admin = () => (token = iniciarSesionComo('administrador'));
  const guardar = () => jest.spyOn(Product.prototype, 'save').mockImplementation(async function (this: any) { return this; });
  const base = { nombre: 'Remolacha', permite_venta_fraccionada: true };

  test('crear un producto fraccionable sin unidades por bulto se rechaza con 400', async () => {
    admin();
    jest.spyOn(Product, 'findOne').mockResolvedValue(null);
    const g = guardar();
    const r = await request(app).post('/api/products').set(conToken(token)).send(base);
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/unidades trae cada bulto/);
    expect(g).not.toHaveBeenCalled();
  });

  test('con unidades por bulto se crea (201)', async () => {
    admin();
    jest.spyOn(Product, 'findOne').mockResolvedValue(null);
    guardar();
    const r = await request(app).post('/api/products').set(conToken(token)).send({ ...base, cantidad_por_bulto: 10 });
    expect(r.status).toBe(201);
    expect(r.body.producto.cantidad_por_bulto).toBe(10);
  });

  test('un producto que no se fracciona no lo necesita', async () => {
    admin();
    jest.spyOn(Product, 'findOne').mockResolvedValue(null);
    guardar();
    const r = await request(app).post('/api/products').set(conToken(token)).send({ nombre: 'Zapallo', permite_venta_fraccionada: false });
    expect(r.status).toBe(201);
  });

  test('menos de 1 por bulto se rechaza (el modelo no lo admite)', async () => {
    admin();
    const r = await request(app).post('/api/products').set(conToken(token)).send({ ...base, cantidad_por_bulto: 0.5 });
    expect(r.status).toBe(400);
  });

  const productoExistente = (o: object = {}) => {
    const p: any = new Product({ nombre: 'Remolacha', unidad_stock: 'cajón', permite_venta_fraccionada: true, cantidad_por_bulto: 10, ...o });
    p.save = jest.fn(async function (this: any) { return this; });
    jest.spyOn(Product, 'findById').mockResolvedValue(p);
    return p;
  };
  const editar = (cuerpo: object) => request(app).put(`/api/products/${oid()}`).set(conToken(token)).send(cuerpo);

  test('pasar un producto a fraccionable sin unidades por bulto se rechaza', async () => {
    admin();
    const p = productoExistente({ permite_venta_fraccionada: false, cantidad_por_bulto: undefined });
    const r = await editar({ permite_venta_fraccionada: true });
    expect(r.status).toBe(400);
    expect(p.save).not.toHaveBeenCalled();
  });

  test('un producto viejo fraccionable sin dato: al editarlo hay que cargarlo', async () => {
    admin();
    jest.spyOn(Product, 'findOne').mockResolvedValue(null); // el nombre no está repetido
    const p = productoExistente({ cantidad_por_bulto: undefined });
    const sin = await editar({ nombre: 'Remolacha chica' });
    expect(sin.status).toBe(400);
    expect(p.save).not.toHaveBeenCalled();
    const con = await editar({ nombre: 'Remolacha chica', cantidad_por_bulto: 12 });
    expect(con.status).toBe(200);
    expect(p.cantidad_por_bulto).toBe(12);
  });

  test('no se puede borrar el dato (null) en un producto fraccionable', async () => {
    admin();
    const p = productoExistente();
    const r = await editar({ cantidad_por_bulto: null });
    expect(r.status).toBe(400);
    expect(p.cantidad_por_bulto).toBe(10);
  });

  test('al sacar la venta fraccionada sí se puede borrar el dato', async () => {
    admin();
    const p = productoExistente();
    const r = await editar({ permite_venta_fraccionada: false, cantidad_por_bulto: null });
    expect(r.status).toBe(200);
    expect(p.cantidad_por_bulto).toBeUndefined();
  });

  test('desactivar un producto viejo fraccionable sin dato no se bloquea', async () => {
    admin();
    const p = productoExistente({ cantidad_por_bulto: undefined });
    const r = await request(app).patch(`/api/products/${oid()}/desactivar`).set(conToken(token));
    expect(r.status).toBe(200);
    expect(p.activo).toBe(false);
  });
});
