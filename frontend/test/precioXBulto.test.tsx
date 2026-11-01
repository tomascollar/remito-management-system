/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pruebas del tercer precio "P.UxB" (precio de unidad por bulto):
 *  - en el remito, al agregar un producto, el selector ofrece P.UxB solo si el producto lo tiene;
 *  - al elegirlo se envía "unidad" + indicador, y el subtotal usa ese precio;
 *  - en Stock, el formulario de precios envía el P.UxB solo si se completó.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgregarProducto } from '../src/pages/remitos/AgregarProducto';
import { PrecioForm } from '../src/pages/stock/StockForms';
import * as stockApi from '../src/api/stock';
import { formatMoneda } from '../src/lib/format';

vi.mock('../src/api/stock');

const producto = (o: any = {}): any => ({
  _id: 'p1', nombre: 'Remolacha', unidad_stock: 'cajón', cantidad_por_bulto: 10,
  permite_venta_fraccionada: true, activo: true, createdAt: '', ...o,
});
const stock = (o: any = {}): any => ({
  _id: 's1', producto: null, cantidad_bultos_inicial: 20, cantidad_bultos_actual: 20,
  precio_bulto: 12000, precio_unidad: 1500, precio_unidad_x_bulto: 1300, fecha: '', ...o,
});

beforeEach(() => vi.resetAllMocks());

/** formatMoneda usa un espacio "duro" (NBSP) entre $ y el número; el buscador de textos lo normaliza a un espacio común. */
const plata = (n: number) => formatMoneda(n).replace(/\s/g, ' ');

/** Muestra el selector del producto elegido (clic en el producto de la lista). */
const abrirProducto = async (filas: any[], onAgregar = vi.fn().mockResolvedValue(undefined)) => {
  const user = userEvent.setup();
  render(<AgregarProducto filas={filas} onAgregar={onAgregar} />);
  await user.click(screen.getByRole('button', { name: /Remolacha/ }));
  return { user, onAgregar };
};

describe('Agregar producto al remito: opción P.UxB', () => {
  it('se ofrece como tercera opción cuando el producto tiene P.UxB', async () => {
    await abrirProducto([{ producto: producto(), stock: stock() }]);
    expect(screen.getByRole('button', { name: /^Bulto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Unidad/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^P\.UxB/ })).toBeInTheDocument();
  });

  it('no se ofrece si el producto no tiene P.UxB cargado', async () => {
    await abrirProducto([{ producto: producto(), stock: stock({ precio_unidad_x_bulto: undefined }) }]);
    expect(screen.queryByRole('button', { name: /^P\.UxB/ })).not.toBeInTheDocument();
  });

  it('no se ofrece en productos que no se venden por unidad', async () => {
    await abrirProducto([{ producto: producto({ permite_venta_fraccionada: false }), stock: stock() }]);
    expect(screen.queryByRole('button', { name: /^P\.UxB/ })).not.toBeInTheDocument();
  });

  it('al elegirlo, el subtotal usa el precio P.UxB y se envía unidad + indicador', async () => {
    const { user, onAgregar } = await abrirProducto([{ producto: producto(), stock: stock() }]);
    await user.click(screen.getByRole('button', { name: /^P\.UxB/ }));
    const cantidad = screen.getByLabelText('Cantidad');
    await user.clear(cantidad);
    await user.type(cantidad, '11');
    expect(screen.getByText(plata(11 * 1300))).toBeInTheDocument(); // 11 × 1.300
    await user.click(screen.getByRole('button', { name: 'Agregar al remito' }));
    expect(onAgregar).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }), 11, 'unidad', true);
  });

  it('con precio común de unidad se envía sin el indicador', async () => {
    const { user, onAgregar } = await abrirProducto([{ producto: producto(), stock: stock() }]);
    await user.click(screen.getByRole('button', { name: /^Unidad/ }));
    await user.click(screen.getByRole('button', { name: 'Agregar al remito' }));
    expect(onAgregar).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }), 1, 'unidad', false);
  });

  it('la venta por bulto sigue enviándose como antes', async () => {
    const { user, onAgregar } = await abrirProducto([{ producto: producto(), stock: stock() }]);
    await user.click(screen.getByRole('button', { name: 'Agregar al remito' }));
    expect(onAgregar).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }), 1, 'bulto', false);
  });

  it('la lista de productos muestra los tres precios', () => {
    render(<AgregarProducto filas={[{ producto: producto(), stock: stock() } as any]} onAgregar={vi.fn()} />);
    expect(screen.getByText((t) => t.replace(/\s/g, ' ').includes(`P.UxB ${plata(1300)}`))).toBeInTheDocument();
  });
});

describe('Stock: formulario de precios con P.UxB', () => {
  const abrirPrecios = (p = producto(), s = stock()) => {
    const onDone = vi.fn();
    render(<PrecioForm producto={p} stock={s} onDone={onDone} />);
    return { onDone, user: userEvent.setup() };
  };

  it('se propone con el P.UxB vigente y lo envía al guardar', async () => {
    vi.mocked(stockApi.actualizarPrecio).mockResolvedValue(undefined);
    const { user, onDone } = abrirPrecios();
    const campo = screen.getByLabelText(/P\.UxB/);
    expect(campo).toHaveValue('1300');
    await user.clear(campo);
    await user.type(campo, '1200');
    await user.click(screen.getByRole('button', { name: 'Guardar precios' }));
    expect(stockApi.actualizarPrecio).toHaveBeenCalledWith('p1', {
      precio_bulto: 12000, precio_unidad: 1500, precio_unidad_x_bulto: 1200,
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('si se deja vacío no se envía el campo', async () => {
    vi.mocked(stockApi.actualizarPrecio).mockResolvedValue(undefined);
    const { user } = abrirPrecios(producto(), stock({ precio_unidad_x_bulto: undefined }));
    await user.click(screen.getByRole('button', { name: 'Guardar precios' }));
    expect(stockApi.actualizarPrecio).toHaveBeenCalledWith('p1', { precio_bulto: 12000, precio_unidad: 1500 });
  });

  it('rechaza un P.UxB que no sea mayor a 0', async () => {
    const { user } = abrirPrecios();
    const campo = screen.getByLabelText(/P\.UxB/);
    await user.clear(campo);
    await user.type(campo, '0');
    await user.click(screen.getByRole('button', { name: 'Guardar precios' }));
    expect(await screen.findByText(/mayor a 0, o dejalo vacío/)).toBeInTheDocument();
    expect(stockApi.actualizarPrecio).not.toHaveBeenCalled();
  });

  it('en productos que no se venden por unidad no aparece el campo', () => {
    abrirPrecios(producto({ permite_venta_fraccionada: false }), stock({ precio_unidad: undefined, precio_unidad_x_bulto: undefined }));
    expect(screen.queryByLabelText(/P\.UxB/)).not.toBeInTheDocument();
  });
});
