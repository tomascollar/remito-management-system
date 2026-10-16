/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { RemitoAcciones } from '../src/pages/remitos/RemitoAcciones';
import * as impresionApi from '../src/api/impresion';
import * as acciones from '../src/lib/pdf/acciones';
import * as raster from '../src/lib/pdf/raster';
import { aBase64, rgbaA1Bit } from '../src/lib/pdf/raster';

vi.mock('../src/api/impresion');
vi.mock('../src/lib/pdf/acciones', () => ({ crearArchivos: vi.fn(), compartir: vi.fn(), descargar: vi.fn(), abrirParaImprimir: vi.fn() }));
vi.mock('../src/lib/pdf/raster', async (original) => ({ ...(await original<typeof raster>()), ticketARaster: vi.fn() }));

const remito: any = { _id: 'r1', numero_remito: 8, nombre_cliente: 'Bunny', items: [], ajustes: [], entregas: [], total: 0, entregado: 0, saldo: 0, estado: 'abierto', fecha: '2026-10-01T10:00:00Z' };
const ticket = { ancho: 576, alto: 1200, datos: 'AAAA' };
const ticketPdf = { name: 'Ticket.pdf' };

/** Error 503 como lo devuelve el servidor cuando no hay agente conectado. */
const error503 = () => Object.assign(new AxiosError('x'), { response: { status: 503, data: { message: 'La impresora no está conectada en este momento' } } });

const ui = () => render(<RemitoAcciones remito={remito} />);
const botonImprimir = () => screen.getByRole('button', { name: /Imprimir|Enviando|Imprimiendo|Impreso/ });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(acciones.crearArchivos).mockResolvedValue({ digital: {}, imagenes: [], ticket: ticketPdf } as any);
  vi.mocked(raster.ticketARaster).mockResolvedValue(ticket);
});
afterEach(() => vi.useRealTimers());

describe('botón Imprimir (cola de impresión)', () => {
  it('envía el ticket y, cuando el agente lo imprime, muestra "Impreso"', async () => {
    vi.mocked(impresionApi.enviarTicket).mockResolvedValue({ id: 'j1', estado: 'pendiente' });
    vi.mocked(impresionApi.getTrabajo)
      .mockResolvedValueOnce({ id: 'j1', estado: 'pendiente' })
      .mockResolvedValueOnce({ id: 'j1', estado: 'imprimiendo' })
      .mockResolvedValue({ id: 'j1', estado: 'impreso' });
    const user = userEvent.setup();
    ui();
    await waitFor(() => expect(botonImprimir()).toBeEnabled());

    await user.click(botonImprimir());

    // se manda la imagen convertida del PDF del ticket, indicando de qué remito es
    expect(raster.ticketARaster).toHaveBeenCalledWith(ticketPdf);
    expect(impresionApi.enviarTicket).toHaveBeenCalledWith(ticket, 'r1');
    expect(screen.getByRole('button', { name: /Imprimiendo/ })).toBeDisabled();

    expect(await screen.findByText('Ticket impreso', {}, { timeout: 6000 })).toBeInTheDocument();
    expect(impresionApi.getTrabajo).toHaveBeenCalledTimes(3);
    expect(acciones.abrirParaImprimir).not.toHaveBeenCalled(); // ya no se abre el PDF
  }, 15000);

  it('sin impresora conectada (503) lo explica y ofrece el ticket en PDF', async () => {
    vi.mocked(impresionApi.enviarTicket).mockRejectedValue(error503());
    const user = userEvent.setup();
    ui();
    await waitFor(() => expect(botonImprimir()).toBeEnabled());
    await user.click(botonImprimir());

    expect(await screen.findByText(/La impresora no está conectada/)).toBeInTheDocument();
    expect(impresionApi.getTrabajo).not.toHaveBeenCalled(); // no se queda esperando algo que no se encoló

    await user.click(screen.getByRole('button', { name: /Abrir el ticket en PDF/ }));
    expect(acciones.abrirParaImprimir).toHaveBeenCalledWith(ticketPdf);
    expect(botonImprimir()).toBeEnabled(); // se puede reintentar
  });

  it('si el agente informa un error (impresora apagada) se lo muestra al usuario', async () => {
    vi.mocked(impresionApi.enviarTicket).mockResolvedValue({ id: 'j1', estado: 'pendiente' });
    vi.mocked(impresionApi.getTrabajo).mockResolvedValue({ id: 'j1', estado: 'error', error: 'La impresora no responde' });
    const user = userEvent.setup();
    ui();
    await waitFor(() => expect(botonImprimir()).toBeEnabled());
    await user.click(botonImprimir());
    expect(await screen.findByText('La impresora no responde', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('un ticket que venció sin que nadie lo tomara se informa como tal', async () => {
    vi.mocked(impresionApi.enviarTicket).mockResolvedValue({ id: 'j1', estado: 'pendiente' });
    vi.mocked(impresionApi.getTrabajo).mockResolvedValue({ id: 'j1', estado: 'vencido' });
    const user = userEvent.setup();
    ui();
    await waitFor(() => expect(botonImprimir()).toBeEnabled());
    await user.click(botonImprimir());
    expect(await screen.findByText(/No se imprimió a tiempo/, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('un ticket demasiado largo no se envía y se explica', async () => {
    vi.mocked(raster.ticketARaster).mockRejectedValue(new raster.TicketMuyLargo('largo'));
    const user = userEvent.setup();
    ui();
    await waitFor(() => expect(botonImprimir()).toBeEnabled());
    await user.click(botonImprimir());
    expect(await screen.findByText(/demasiado largo/)).toBeInTheDocument();
    expect(impresionApi.enviarTicket).not.toHaveBeenCalled();
  });

  it('un doble toque no encola el ticket dos veces', async () => {
    let soltar!: () => void;
    vi.mocked(raster.ticketARaster).mockImplementation(() => new Promise((ok) => { soltar = () => ok(ticket); }));
    vi.mocked(impresionApi.enviarTicket).mockResolvedValue({ id: 'j1', estado: 'pendiente' });
    vi.mocked(impresionApi.getTrabajo).mockResolvedValue({ id: 'j1', estado: 'impreso' });
    const user = userEvent.setup();
    ui();
    await waitFor(() => expect(botonImprimir()).toBeEnabled());

    await user.click(botonImprimir());
    await user.click(screen.getByRole('button', { name: /Enviando/ })); // segundo toque con el botón ocupado
    await act(async () => soltar());
    await screen.findByText('Ticket impreso', {}, { timeout: 4000 });

    expect(raster.ticketARaster).toHaveBeenCalledTimes(1);
    expect(impresionApi.enviarTicket).toHaveBeenCalledTimes(1);
  });

  it('si se sale de la pantalla se deja de consultar', async () => {
    vi.mocked(impresionApi.enviarTicket).mockResolvedValue({ id: 'j1', estado: 'pendiente' });
    vi.mocked(impresionApi.getTrabajo).mockResolvedValue({ id: 'j1', estado: 'pendiente' });
    const user = userEvent.setup();
    const { unmount } = ui();
    await waitFor(() => expect(botonImprimir()).toBeEnabled());
    await user.click(botonImprimir());
    await waitFor(() => expect(impresionApi.getTrabajo).toHaveBeenCalledTimes(1), { timeout: 3000 });
    unmount();
    const llamadas = vi.mocked(impresionApi.getTrabajo).mock.calls.length;
    await new Promise((r) => setTimeout(r, 2200));
    expect(vi.mocked(impresionApi.getTrabajo).mock.calls.length).toBe(llamadas);
  }, 10000);
});

describe('conversión del ticket a imagen de la térmica', () => {
  const pixel = (r: number, g: number, b: number, a = 255) => [r, g, b, a];
  const imagen = (filas: number[][][]) => new Uint8ClampedArray(filas.flat(2));

  it('empaqueta 8 puntos por byte, el primero en el bit más significativo (1 = negro)', () => {
    const N = pixel(0, 0, 0), B = pixel(255, 255, 255);
    // Una fila de 8 puntos: negro, blanco, negro, negro, blanco, blanco, blanco, negro = 10110001 = 0xB1
    const bits = rgbaA1Bit(imagen([[N, B, N, N, B, B, B, N]]), 8, 1, 0, 8);
    expect([...bits]).toEqual([0xb1]);
  });

  it('recorta las columnas del centro y respeta el alto', () => {
    const N = pixel(0, 0, 0), B = pixel(255, 255, 255);
    // Origen de 16 columnas; se toman 8 desde la columna 4 (las dos de cada borde se descartan)
    const fila = [B, B, B, B, N, N, N, N, N, N, N, N, B, B, B, B];
    const bits = rgbaA1Bit(imagen([fila, fila]), 16, 2, 4, 8);
    expect([...bits]).toEqual([0xff, 0xff]);
  });

  it('los grises claros salen blancos y los oscuros negros; lo transparente es blanco', () => {
    const bits = rgbaA1Bit(imagen([[pixel(200, 200, 200), pixel(100, 100, 100), pixel(0, 0, 0, 0), pixel(0, 0, 0, 255), pixel(255, 235, 85), pixel(255, 255, 255), pixel(150, 150, 150), pixel(170, 170, 170)]]), 8, 1, 0, 8);
    // claro→0, oscuro→1, transparente→0, negro→1, amarillo claro→0, blanco→0, 150→1, 170→0  = 01010010
    expect(bits[0]).toBe(0b01010010);
  });

  it('base64 de una imagen grande (más de un tramo) se puede decodificar sin pérdida', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 31) % 256);
    const texto = aBase64(bytes);
    const vuelta = Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
    expect(vuelta.length).toBe(bytes.length);
    expect(vuelta.every((b, i) => b === bytes[i])).toBe(true);
  });
});
