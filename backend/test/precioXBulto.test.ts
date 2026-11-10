/**
 * Pruebas del tercer precio "P.UxB" (precio de unidad por bulto): el precio por unidad que se
 * aplica cuando el cliente lleva un bulto o una cantidad grande (suele ser menor al común).
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

/** Remito abierto y vacío. */
const crearRemito = () => {
  const remito: any = new Remito({ nombre_cliente: 'Jose', vendedor: oid(), estado: 'abierto', items: [], total: 0 });
  remito.save = jest.fn(async function (this: any) { return this; });
  jest.spyOn(Remito, 'findById').mockResolvedValue(remito);
  return remito;
};

/** Producto fraccionable (remolacha, 10 por bulto) y su stock: unidad $1.500, P.UxB $1.300, bulto $12.000. */
const crearProductoYStock = ({ conPxB = true, fraccionable = true } = {}) => {
  const producto: any = new Product({
    nombre: 'Remolacha', unidad_stock: 'cajón', permite_venta_fraccionada: fraccionable, cantidad_por_bulto: 10,
  });
  const stock: any = new StockDiario({
    producto: producto._id,
    cantidad_bultos_inicial: 20,
    cantidad_bultos_actual: 20,
    precio_bulto: 12000,
    precio_unidad: 1500,
    ...(conPxB && { precio_unidad_x_bulto: 1300 }),
  });
  stock.save = jest.fn(async function (this: any) { return this; });
  jest.spyOn(Product, 'findById').mockResolvedValue(producto);
  jest.spyOn(StockDiario, 'findOne').mockResolvedValue(stock);
  jest.spyOn(MovimientoStock, 'create').mockResolvedValue({} as any);
  return { producto, stock };
};

beforeEach(() => {
  reiniciarLimitadores();
  token = iniciarSesionComo('vendedor');
  remitoId = oid().toString();
});

const agregar = (cuerpo: object) =>
  request(app).post(`/api/remitos/${remitoId}/items`).set(conToken(token)).send({ producto: oid().toString(), ...cuerpo });

describe('Venta por unidad con precio P.UxB', () => {
  test('usa el precio P.UxB, marca el ítem y calcula el subtotal con él', async () => {
    const remito = crearRemito();
    crearProductoYStock();
    const r = await agregar({ cantidad: 11, unidad_venta: 'unidad', precio_x_bulto: true });
    expect(r.status).toBe(201);
    expect(remito.items).toHaveLength(1);
    expect(remito.items[0].precio_unitario).toBe(1300);
    expect(remito.items[0].precio_x_bulto).toBe(true);
    expect(remito.items[0].subtotal).toBe(14300); // 11 × 1.300
    expect(remito.total).toBe(14300);
  });

  test('sin el indicador se sigue usando el precio por unidad común', async () => {
    const remito = crearRemito();
    crearProductoYStock();
    const r = await agregar({ cantidad: 1, unidad_venta: 'unidad' });
    expect(r.status).toBe(201);
    expect(remito.items[0].precio_unitario).toBe(1500);
    expect(remito.items[0].precio_x_bulto).toBe(false);
  });

  test('la venta por unidad con P.UxB también descuenta stock: 11 u. con 10 por bulto = 1,1 bultos', async () => {
    crearRemito();
    const { stock } = crearProductoYStock();
    await agregar({ cantidad: 11, unidad_venta: 'unidad', precio_x_bulto: true }).expect(201);
    expect(stock.cantidad_bultos_actual).toBe(18.9);
    expect(stock.save).toHaveBeenCalled();
  });

  test('si el producto no tiene P.UxB cargado se rechaza con 400 y no modifica el remito', async () => {
    const remito = crearRemito();
    crearProductoYStock({ conPxB: false });
    const r = await agregar({ cantidad: 11, unidad_venta: 'unidad', precio_x_bulto: true });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/P\.UxB/);
    expect(remito.items).toHaveLength(0);
    expect(remito.save).not.toHaveBeenCalled();
  });

  test('el mismo producto a precio común y a P.UxB va en líneas separadas', async () => {
    const remito = crearRemito();
    crearProductoYStock();
    await agregar({ cantidad: 1, unidad_venta: 'unidad' }).expect(201);
    await agregar({ cantidad: 11, unidad_venta: 'unidad', precio_x_bulto: true }).expect(201);
    expect(remito.items).toHaveLength(2);
    expect(remito.total).toBe(1500 + 14300);
  });

  test('aunque el P.UxB valga lo mismo que el precio común, no se mezclan en una línea', async () => {
    const remito = crearRemito();
    const { stock } = crearProductoYStock();
    stock.precio_unidad_x_bulto = 1500; // mismo valor que el precio común
    await agregar({ cantidad: 1, unidad_venta: 'unidad' }).expect(201);
    await agregar({ cantidad: 11, unidad_venta: 'unidad', precio_x_bulto: true }).expect(201);
    expect(remito.items).toHaveLength(2);
    expect(remito.items.map((i: any) => i.precio_x_bulto)).toEqual([false, true]);
  });

  test('dos cargas a P.UxB se fusionan en una sola línea', async () => {
    const remito = crearRemito();
    crearProductoYStock();
    await agregar({ cantidad: 11, unidad_venta: 'unidad', precio_x_bulto: true }).expect(201);
    await agregar({ cantidad: 4, unidad_venta: 'unidad', precio_x_bulto: true }).expect(201);
    expect(remito.items).toHaveLength(1);
    expect(remito.items[0].cantidad).toBe(15);
    expect(remito.items[0].subtotal).toBe(19500);
  });

  test('en una venta por bulto el indicador se ignora (se usa el precio del bulto)', async () => {
    const remito = crearRemito();
    crearProductoYStock();
    await agregar({ cantidad: 1, unidad_venta: 'bulto', precio_x_bulto: true }).expect(201);
    expect(remito.items[0].precio_unitario).toBe(12000);
    expect(remito.items[0].precio_x_bulto).toBe(false);
  });

  test.each([['texto "true"', 'true'], ['número 1', 1], ['texto vacío', '']])(
    'precio_x_bulto inválido (%s) se rechaza con 400',
    async (_nombre, valor) => {
      crearRemito();
      crearProductoYStock();
      const r = await agregar({ cantidad: 1, unidad_venta: 'unidad', precio_x_bulto: valor });
      expect(r.status).toBe(400);
    },
  );

  test('un cambio posterior de precio no altera lo ya vendido (el precio queda congelado)', async () => {
    const remito = crearRemito();
    const { stock } = crearProductoYStock();
    await agregar({ cantidad: 11, unidad_venta: 'unidad', precio_x_bulto: true }).expect(201);
    stock.precio_unidad_x_bulto = 1000; // el precio baja durante el día
    await agregar({ cantidad: 5, unidad_venta: 'unidad', precio_x_bulto: true }).expect(201);
    expect(remito.items).toHaveLength(2); // distinto precio = otra línea
    expect(remito.items[0].precio_unitario).toBe(1300);
    expect(remito.items[1].precio_unitario).toBe(1000);
  });
});

describe('Carga de P.UxB en el stock', () => {
  const adm = () => (token = iniciarSesionComo('administrador'));

  test('registrar stock de un producto fraccionable guarda el P.UxB', async () => {
    adm();
    const { producto } = crearProductoYStock();
    producto.activo = true;
    jest.spyOn(StockDiario, 'updateMany').mockResolvedValue({} as any);
    const guardar = jest.spyOn(StockDiario.prototype, 'save').mockImplementation(async function (this: any) { return this; });
    const r = await request(app).post('/api/stock-diario').set(conToken(token)).send({
      producto: producto._id.toString(), cantidad_bultos_inicial: 10, precio_bulto: 12000, precio_unidad: 1500, precio_unidad_x_bulto: 1300,
    });
    expect(r.status).toBe(201);
    expect(r.body.stock.precio_unidad_x_bulto).toBe(1300);
    expect(guardar).toHaveBeenCalled();
  });

  test('en un producto que no se fracciona el P.UxB se descarta', async () => {
    adm();
    const { producto } = crearProductoYStock({ fraccionable: false });
    producto.activo = true;
    jest.spyOn(StockDiario, 'updateMany').mockResolvedValue({} as any);
    jest.spyOn(StockDiario.prototype, 'save').mockImplementation(async function (this: any) { return this; });
    const r = await request(app).post('/api/stock-diario').set(conToken(token)).send({
      producto: producto._id.toString(), cantidad_bultos_inicial: 10, precio_bulto: 12000, precio_unidad_x_bulto: 1300,
    });
    expect(r.status).toBe(201);
    expect(r.body.stock.precio_unidad_x_bulto).toBeUndefined();
  });

  test('cambiar precios actualiza el P.UxB y valida que sea mayor a 0', async () => {
    adm();
    const { producto, stock } = crearProductoYStock();
    const url = `/api/stock-diario/${producto._id}/precio`;
    const ok = await request(app).patch(url).set(conToken(token)).send({ precio_unidad_x_bulto: 1200 });
    expect(ok.status).toBe(200);
    expect(stock.precio_unidad_x_bulto).toBe(1200);
    const mal = await request(app).patch(url).set(conToken(token)).send({ precio_unidad_x_bulto: 0 });
    expect(mal.status).toBe(400);
  });

  test('un vendedor no puede cargar precios (403)', async () => {
    token = iniciarSesionComo('vendedor');
    const r = await request(app).patch(`/api/stock-diario/${oid()}/precio`).set(conToken(token)).send({ precio_unidad_x_bulto: 1200 });
    expect(r.status).toBe(403);
  });
});
