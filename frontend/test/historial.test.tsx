/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import HistorialStock from '../src/pages/stock/HistorialStock';
import * as stockApi from '../src/api/stock';
import * as productsApi from '../src/api/products';

vi.mock('../src/api/stock');
vi.mock('../src/api/products');

const mov = (o: object) => ({
  _id: 'm', fecha: '2026-10-02T15:32:00.000Z', tipo: 'ajuste', cantidad_bultos: -2,
  producto: { _id: 'p1', nombre: 'Papa' }, usuario: { _id: 'u1', nombre: 'Denisse', email: 'd@d.com' }, ...o,
});
const pagina = (movimientos: any[], extra = {}) => ({ movimientos, total: movimientos.length, pagina: 1, limite: 20, totalPaginas: 1, ...extra });
const ui = () => render(<MemoryRouter><HistorialStock /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(productsApi.listProductos).mockResolvedValue([
    { _id: 'p1', nombre: 'Papa', activo: true } as any,
    { _id: 'p2', nombre: 'Cebolla', activo: true } as any,
  ]);
});

describe('HistorialStock', () => {
  it('muestra cada movimiento con signo, tipo, usuario, observación y enlace al remito', async () => {
    vi.mocked(stockApi.listMovimientos).mockResolvedValue(pagina([
      mov({ _id: 'a', tipo: 'ajuste', cantidad_bultos: -2, observaciones: 'se pudrió un bulto' }),
      mov({ _id: 'b', tipo: 'venta', cantidad_bultos: -1, remito: { _id: 'r1', numero_remito: 8, nombre_cliente: 'Rosa' } }),
      mov({ _id: 'c', tipo: 'entrada_adicional', cantidad_bultos: 1.5, producto: null }),
    ]));
    ui();
    expect(await screen.findByText('se pudrió un bulto')).toBeInTheDocument();
    expect(screen.getByText('−2')).toBeInTheDocument();
    expect(screen.getByText('+1,5')).toBeInTheDocument();
    expect(screen.getByText('Ajuste manual', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Producto eliminado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Remito #8' })).toHaveAttribute('href', '/remitos/r1');
    expect(screen.getAllByText(/Denisse/).length).toBeGreaterThan(0);
  });

  it('por defecto muestra los últimos 7 días y al filtrar vuelve a pedir al servidor', async () => {
    vi.mocked(stockApi.listMovimientos).mockResolvedValue(pagina([mov({ _id: 'a' })]));
    ui();
    await screen.findByText('Papa', { selector: 'p' });
    expect(stockApi.listMovimientos).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: undefined, producto: undefined, pagina: 1, desde: expect.any(String) }));

    await userEvent.selectOptions(screen.getByLabelText('Tipo de movimiento'), 'venta');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), 'p2');
    await userEvent.click(screen.getByRole('button', { name: 'Todo' }));
    await waitFor(() =>
      expect(stockApi.listMovimientos).toHaveBeenLastCalledWith({ tipo: 'venta', producto: 'p2', desde: undefined, pagina: 1 }));
  });

  it('carga más páginas sin repetir filas', async () => {
    vi.mocked(stockApi.listMovimientos)
      .mockResolvedValueOnce(pagina([mov({ _id: 'a', observaciones: 'primero' })], { total: 2, totalPaginas: 2 }))
      .mockResolvedValueOnce(pagina([mov({ _id: 'a', observaciones: 'primero' }), mov({ _id: 'b', observaciones: 'segundo' })], { total: 2, pagina: 2, totalPaginas: 2 }));
    ui();
    await screen.findByText('primero');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByText('segundo')).toBeInTheDocument();
    expect(screen.getAllByText('primero')).toHaveLength(1);
    expect(stockApi.listMovimientos).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 }));
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('sin resultados lo avisa, y ante un error permite reintentar', async () => {
    vi.mocked(stockApi.listMovimientos).mockResolvedValueOnce(pagina([]));
    ui();
    expect(await screen.findByText('No hay movimientos que coincidan.')).toBeInTheDocument();

    vi.mocked(stockApi.listMovimientos).mockRejectedValueOnce(new Error('x'));
    await userEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
