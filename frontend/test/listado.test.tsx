/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import Remitos from '../src/pages/remitos/Remitos';
import * as remitosApi from '../src/api/remitos';

vi.mock('../src/api/remitos');
vi.mock('../src/context/useAuth', () => ({ useAuth: () => ({ usuario: { id: 'u1', nombre: 'Dani', rol: 'vendedor' } }) }));

const fila = (id: string, numero: number, cliente: string): any => ({
  _id: id, numero_remito: numero, fecha: '2026-10-05T14:00:00.000Z', nombre_cliente: cliente, total: 1000, estado: 'abierto',
  vendedor: { _id: 'v', nombre: 'Dani', email: 'd@d' }, createdAt: '', cantidad_items: 1, entregado: 0, saldo: 1000, estado_pago: 'pendiente',
});
const pagina = (remitos: any[]): any => ({ remitos, total: remitos.length, pagina: 1, limite: 20, totalPaginas: 1 });

const ui = () => render(<MemoryRouter><Remitos /></MemoryRouter>);
/** Parámetros con los que se pidió el listado la última vez. */
const ultimaConsulta = () => vi.mocked(remitosApi.listRemitos).mock.calls.at(-1)![0] as any;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(remitosApi.listRemitos).mockResolvedValue(pagina([fila('a', 2, 'Zulema'), fila('b', 1, 'Ana')]));
});

describe('orden del listado de remitos', () => {
  it('por defecto no pide ningún orden especial (el servidor entrega los últimos creados primero)', async () => {
    ui();
    await screen.findByText('Zulema');
    expect(ultimaConsulta().orden).toBeUndefined();
    expect(screen.getByRole('button', { name: /A–Z/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('al tocar A–Z se vuelve a pedir el listado ordenado alfabéticamente', async () => {
    const user = userEvent.setup();
    ui();
    await screen.findByText('Zulema');

    await user.click(screen.getByRole('button', { name: /A–Z/ }));

    await waitFor(() => expect(ultimaConsulta().orden).toBe('alfabetico'));
    expect(ultimaConsulta().pagina).toBe(1); // se vuelve a la primera página
    expect(screen.getByRole('button', { name: /A–Z/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('al tocarlo de nuevo se vuelve al orden por defecto', async () => {
    const user = userEvent.setup();
    ui();
    await screen.findByText('Zulema');

    await user.click(screen.getByRole('button', { name: /A–Z/ }));
    await waitFor(() => expect(ultimaConsulta().orden).toBe('alfabetico'));
    await user.click(screen.getByRole('button', { name: /A–Z/ }));

    await waitFor(() => expect(ultimaConsulta().orden).toBeUndefined());
    expect(screen.getByRole('button', { name: /A–Z/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('el orden se conserva al cambiar de filtro (Abiertos / Hoy / Todos)', async () => {
    const user = userEvent.setup();
    ui();
    await screen.findByText('Zulema');

    await user.click(screen.getByRole('button', { name: /A–Z/ }));
    await user.click(screen.getByRole('button', { name: 'Todos' }));

    await waitFor(() => expect(ultimaConsulta().estado).toBeUndefined());
    expect(ultimaConsulta().orden).toBe('alfabetico');
  });
});
