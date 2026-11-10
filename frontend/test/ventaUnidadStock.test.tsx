/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pruebas de la fase 2 de la venta por unidad (descuenta stock por equivalencia):
 *  - al agregar, se muestra cuántos bultos descuenta y se bloquea si no alcanza el stock;
 *  - un producto sin "unidades por bulto" no se puede vender por unidad;
 *  - al cambiar la cantidad de una línea por unidad se respeta el tope en unidades;
 *  - el formulario de producto exige las unidades por bulto si es fraccionable;
 *  - el cambio local de cantidad calcula los bultos igual que el servidor.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgregarProducto } from '../src/pages/remitos/AgregarProducto';
import { EditarCantidad } from '../src/pages/remitos/EditarCantidad';
import { ProductoForm } from '../src/pages/productos/ProductoForm';
import * as productosApi from '../src/api/products';
import { conCantidad } from '../src/lib/remitos';

vi.mock('../src/api/products');

const producto = (o: any = {}): any => ({
  _id: 'p1', nombre: 'Remolacha', unidad_stock: 'cajón', cantidad_por_bulto: 10,
  permite_venta_fraccionada: true, activo: true, createdAt: '', ...o,
});
const stock = (o: any = {}): any => ({
  _id: 's1', producto: null, cantidad_bultos_inicial: 20, cantidad_bultos_actual: 20,
  precio_bulto: 12000, precio_unidad: 1500, precio_unidad_x_bulto: 1300, fecha: '', ...o,
});

beforeEach(() => vi.resetAllMocks());

/** Abre el producto de la lista y pasa al modo indicado (Bulto / Unidad / P.UxB). */
const abrir = async (filas: any[], modo?: RegExp) => {
  const user = userEvent.setup();
  const onAgregar = vi.fn().mockResolvedValue(undefined);
  render(<AgregarProducto filas={filas} onAgregar={onAgregar} />);
  await user.click(screen.getByRole('button', { name: /Remolacha/ }));
  if (modo) await user.click(screen.getByRole('button', { name: modo }));
  return { user, onAgregar };
};
const escribir = async (user: ReturnType<typeof userEvent.setup>, valor: string) => {
  const campo = screen.getByLabelText('Cantidad');
  await user.clear(campo);
  await user.type(campo, valor);
};
const agregarBtn = () => screen.getByRole('button', { name: 'Agregar al remito' });

describe('Agregar por unidad: descuento de stock', () => {
  it('muestra cuántos bultos descuenta: 11 unidades con 10 por bulto = 1,1', async () => {
    const { user } = await abrir([{ producto: producto(), stock: stock() }], /^Unidad/);
    await escribir(user, '11');
    expect(screen.getByText('Descuenta 1,1 bultos del stock.')).toBeInTheDocument();
  });

  it('con P.UxB también descuenta y lo avisa', async () => {
    const { user } = await abrir([{ producto: producto(), stock: stock() }], /^P\.UxB/);
    await escribir(user, '11');
    expect(screen.getByText('Descuenta 1,1 bultos del stock.')).toBeInTheDocument();
  });

  it('en venta por bulto no muestra el aviso de descuento por unidades', async () => {
    await abrir([{ producto: producto(), stock: stock() }]);
    expect(screen.queryByText(/Descuenta .* bultos del stock/)).not.toBeInTheDocument();
  });

  it('si no alcanza el stock avisa cuántas unidades alcanzan y bloquea el botón', async () => {
    const { user, onAgregar } = await abrir([{ producto: producto(), stock: stock({ cantidad_bultos_actual: 1 }) }], /^Unidad/);
    await escribir(user, '11'); // necesita 1,1 y hay 1
    expect(screen.getByText(/Solo hay 1 bultos disponibles \(alcanzan para 10 unidades\)/)).toBeInTheDocument();
    expect(agregarBtn()).toBeDisabled();
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('se puede vender justo lo que hay', async () => {
    const { user, onAgregar } = await abrir([{ producto: producto(), stock: stock({ cantidad_bultos_actual: 1 }) }], /^Unidad/);
    await escribir(user, '10');
    expect(agregarBtn()).toBeEnabled();
    await user.click(agregarBtn());
    expect(onAgregar).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }), 10, 'unidad', false);
  });

  it('un producto sin unidades por bulto no se puede vender por unidad (sí por bulto)', async () => {
    const filas = [{ producto: producto({ cantidad_por_bulto: undefined }), stock: stock() }];
    const { user, onAgregar } = await abrir(filas, /^Unidad/);
    expect(screen.getByText(/no tiene cargadas las unidades por bulto/)).toBeInTheDocument();
    expect(agregarBtn()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Bulto/ }));
    expect(screen.queryByText(/no tiene cargadas las unidades por bulto/)).not.toBeInTheDocument();
    await user.click(agregarBtn());
    expect(onAgregar).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }), 1, 'bulto', false);
  });

  it('en la lista, un producto sin stock queda bloqueado aunque se venda por unidad', () => {
    render(<AgregarProducto filas={[{ producto: producto(), stock: stock({ cantidad_bultos_actual: 0 }) } as any]} onAgregar={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Remolacha/ })).toBeDisabled();
  });
});

describe('Cambiar la cantidad de una línea', () => {
  const linea = (o: any = {}): any => ({
    _id: 'i1', producto: 'p1', nombre_producto: 'Remolacha', cantidad: 11, unidad_venta: 'unidad',
    bultos_consumidos: 1.1, contenido_por_bulto: 10, precio_unitario: 1500, subtotal: 16500, ...o,
  });
  const cantidadInput = () => screen.getByLabelText('Cantidad');

  it('en una línea por unidad el tope son las unidades que quedan (bultos libres × unidades por bulto)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn();
    render(<EditarCantidad item={linea()} disponible={0.9} onGuardar={onGuardar} />); // 11 + 9 = 20
    await user.clear(cantidadInput());
    await user.type(cantidadInput(), '21');
    expect(screen.getByText('Como máximo podés tener 20 unidades.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cantidad' })).toBeDisabled();
    await user.clear(cantidadInput());
    await user.type(cantidadInput(), '20');
    expect(screen.getByRole('button', { name: 'Guardar cantidad' })).toBeEnabled();
  });

  it('una línea por unidad vieja (sin contenido guardado) no tiene tope', async () => {
    const user = userEvent.setup();
    render(<EditarCantidad item={linea({ contenido_por_bulto: undefined, bultos_consumidos: 0 })} disponible={0} onGuardar={vi.fn()} />);
    await user.clear(cantidadInput());
    await user.type(cantidadInput(), '500');
    expect(screen.queryByText(/Como máximo/)).not.toBeInTheDocument();
  });

  it('en una línea por bulto el tope sigue siendo en bultos', async () => {
    const user = userEvent.setup();
    const item = linea({ unidad_venta: 'bulto', cantidad: 2, bultos_consumidos: 2, contenido_por_bulto: undefined });
    render(<EditarCantidad item={item} disponible={1} onGuardar={vi.fn()} />);
    await user.clear(cantidadInput());
    await user.type(cantidadInput(), '4');
    expect(screen.getByText('Como máximo podés tener 3 bultos.')).toBeInTheDocument();
  });
});

describe('Cambio local de cantidad (igual que el servidor)', () => {
  const remito = (it: any): any => ({ items: [{ _id: 'i1', precio_unitario: 1500, subtotal: 0, ...it }], ajustes: [], entregado: 0, total: 0, saldo: 0 });

  it('por unidad: bultos = cantidad ÷ unidades por bulto de la línea', () => {
    const r = conCantidad(remito({ cantidad: 11, unidad_venta: 'unidad', contenido_por_bulto: 10, bultos_consumidos: 1.1 }), 'i1', 15);
    expect(r.items[0].bultos_consumidos).toBe(1.5);
    expect(r.items[0].subtotal).toBe(22500);
  });

  it('por unidad: sin ruido de punto flotante (3 u. con 10 por bulto = 0,3)', () => {
    const r = conCantidad(remito({ cantidad: 1, unidad_venta: 'unidad', contenido_por_bulto: 10, bultos_consumidos: 0.1 }), 'i1', 3);
    expect(r.items[0].bultos_consumidos).toBe(0.3);
  });

  it('por bulto: 1 a 1', () => {
    const r = conCantidad(remito({ cantidad: 2, unidad_venta: 'bulto', bultos_consumidos: 2 }), 'i1', 3);
    expect(r.items[0].bultos_consumidos).toBe(3);
  });

  it('línea por unidad vieja (sin contenido): sigue en 0', () => {
    const r = conCantidad(remito({ cantidad: 5, unidad_venta: 'unidad', bultos_consumidos: 0 }), 'i1', 9);
    expect(r.items[0].bultos_consumidos).toBe(0);
  });
});

describe('Formulario de producto: unidades por bulto', () => {
  const abrirForm = (p: any = null) => {
    const onSaved = vi.fn();
    render(<ProductoForm producto={p} onSaved={onSaved} />);
    return { onSaved, user: userEvent.setup() };
  };
  const llenar = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Nombre'), 'Remolacha');
  };
  const guardar = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: /Crear producto|Guardar cambios/ }));

  it('el campo aparece solo si el producto permite venta fraccionada', async () => {
    const { user } = abrirForm();
    expect(screen.queryByLabelText('Unidades por bulto')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch'));
    expect(screen.getByLabelText('Unidades por bulto')).toBeInTheDocument();
  });

  it('si es fraccionable y queda vacío se exige y no se envía nada', async () => {
    const { user } = abrirForm();
    await llenar(user);
    await user.click(screen.getByRole('switch'));
    await guardar(user);
    expect(await screen.findByText('Indicá cuántas unidades trae cada bulto')).toBeInTheDocument();
    expect(productosApi.createProducto).not.toHaveBeenCalled();
  });

  it('con las unidades por bulto se guarda y las envía como número', async () => {
    vi.mocked(productosApi.createProducto).mockResolvedValue(undefined);
    const { user, onSaved } = abrirForm();
    await llenar(user);
    await user.click(screen.getByRole('switch'));
    await user.type(screen.getByLabelText('Unidades por bulto'), '10');
    await guardar(user);
    expect(productosApi.createProducto).toHaveBeenCalledWith(expect.objectContaining({ permite_venta_fraccionada: true, cantidad_por_bulto: 10 }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('menos de 1 se rechaza', async () => {
    const { user } = abrirForm();
    await llenar(user);
    await user.click(screen.getByRole('switch'));
    await user.type(screen.getByLabelText('Unidades por bulto'), '0,5');
    await guardar(user);
    expect(await screen.findByText('Ingresá un número igual o mayor a 1')).toBeInTheDocument();
    expect(productosApi.createProducto).not.toHaveBeenCalled();
  });

  it('un producto que no se fracciona no lo necesita y se envía null', async () => {
    vi.mocked(productosApi.createProducto).mockResolvedValue(undefined);
    const { user } = abrirForm();
    await llenar(user);
    await guardar(user);
    expect(productosApi.createProducto).toHaveBeenCalledWith(expect.objectContaining({ permite_venta_fraccionada: false, cantidad_por_bulto: null }));
  });

  it('un producto viejo fraccionable sin el dato obliga a cargarlo al editarlo', async () => {
    const { user } = abrirForm(producto({ cantidad_por_bulto: undefined }));
    await guardar(user);
    expect(await screen.findByText('Indicá cuántas unidades trae cada bulto')).toBeInTheDocument();
    expect(productosApi.updateProducto).not.toHaveBeenCalled();
  });
});
