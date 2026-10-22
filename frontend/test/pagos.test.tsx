/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import RemitoDetalle from '../src/pages/remitos/RemitoDetalle';
import { RemitoCard } from '../src/pages/remitos/RemitoCard';
import * as remitosApi from '../src/api/remitos';
import * as acciones from '../src/lib/pdf/acciones';
import { conCantidad, estadoPagoDe, sinItem, totalDe } from '../src/lib/remitos';
import { generarRemitoDigitalPdf } from '../src/lib/pdf/digital';
import { generarTicketPdf } from '../src/lib/pdf/ticket';

vi.mock('../src/api/remitos');
// El catálogo y los PDFs no son el tema de estas pruebas
vi.mock('../src/hooks/useCatalogoVenta', () => ({ useCatalogoVenta: () => ({ filas: [], loading: false, error: null, reload: vi.fn() }) }));
vi.mock('../src/lib/pdf/acciones', () => ({
  crearArchivos: vi.fn(),
  compartir: vi.fn(), descargar: vi.fn(), abrirParaImprimir: vi.fn(),
}));

const item = (o = {}) => ({ _id: 'i1', producto: 'p1', nombre_producto: 'Tomate', cantidad: 3, unidad_venta: 'bulto', bultos_consumidos: 3, precio_unitario: 1000, subtotal: 3000, ...o });
const remito = (o: any = {}): any => ({
  _id: 'r1', numero_remito: 7, fecha: '2026-10-05T14:00:00.000Z', nombre_cliente: 'Jose', vendedor: { _id: 'v', nombre: 'Dani', email: 'd@d' },
  estado: 'abierto', createdAt: '', items: [item()], ajustes: [], entregas: [], total: 3000, entregado: 0, saldo: 3000, ...o,
});
const entrega = (o = {}) => ({ _id: 'e1', monto: 1000, fecha: '2026-10-05T15:00:00.000Z', usuario: 'u', anulada: false, ...o });

const ui = () =>
  render(
    <MemoryRouter initialEntries={['/remitos/r1']}>
      <Routes><Route path="/remitos/:id" element={<RemitoDetalle />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(acciones.crearArchivos).mockResolvedValue({ digital: {}, imagenes: [], ticket: {} } as any);
});

describe('cálculos locales', () => {
  it('el total incluye los ajustes y el saldo descuenta lo entregado', () => {
    const r = remito({ ajustes: [{ _id: 'a', concepto: 'Saldo anterior', monto: 1000 }], total: 4000, entregado: 500, saldo: 3500 });
    expect(totalDe(r.items, r.ajustes)).toBe(4000);
    const sin = sinItem(r, 'i1');
    expect(sin.total).toBe(1000); // queda el ajuste
    expect(sin.saldo).toBe(500);
    const mas = conCantidad(r, 'i1', 5);
    expect(mas.total).toBe(6000);
    expect(mas.saldo).toBe(5500);
  });

  it('estado de cobro: pendiente, parcial, pagado', () => {
    expect(estadoPagoDe(100, 0)).toBe('pendiente');
    expect(estadoPagoDe(100, 40)).toBe('parcial');
    expect(estadoPagoDe(100, 100)).toBe('pagado');
  });
});

describe('detalle del remito: entregas', () => {
  it('registra una entrega con el botón "Todo" y muestra el nuevo saldo', async () => {
    vi.mocked(remitosApi.getRemito).mockResolvedValue(remito());
    vi.mocked(remitosApi.registrarEntrega).mockResolvedValue(
      remito({ entregas: [entrega({ monto: 3000 })], entregado: 3000, saldo: 0 }),
    );
    const user = userEvent.setup();
    ui();
    await user.click(await screen.findByRole('button', { name: /Registrar entrega/ }));
    await user.click(screen.getByRole('button', { name: 'Todo' }));
    expect(screen.getByLabelText('Monto entregado')).toHaveValue('3000');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Registrar entrega' }));

    expect(remitosApi.registrarEntrega).toHaveBeenCalledWith('r1', { monto: 3000, nota: undefined });
    expect(await screen.findAllByText('Pagado')).not.toHaveLength(0);

        // aunque no quede saldo, se puede seguir registrando entregas (saldo a favor del cliente)
    expect(screen.getByRole('button', { name: /Registrar entrega/ })).toBeInTheDocument();
  });

    it('si la entrega supera el saldo lo permite y avisa cuánto queda a favor del cliente', async () => {
    vi.mocked(remitosApi.getRemito).mockResolvedValue(remito()); // saldo 3000
    const user = userEvent.setup();
    ui();
    await user.click(await screen.findByRole('button', { name: /Registrar entrega/ }));
    await user.type(screen.getByLabelText('Monto entregado'), '3500');
    expect(screen.getByText(/Queda a favor del cliente/)).toBeInTheDocument();
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Registrar entrega' })).toBeEnabled();
  });

  it('si el servidor rechaza la entrega, el error se ve en el formulario', async () => {
    vi.mocked(remitosApi.getRemito).mockResolvedValue(remito());
    vi.mocked(remitosApi.registrarEntrega).mockRejectedValue({ isAxiosError: true, response: { data: { message: 'La entrega supera el saldo pendiente (100)' } } });
    const user = userEvent.setup();
    ui();
    await user.click(await screen.findByRole('button', { name: /Registrar entrega/ }));
    await user.type(screen.getByLabelText('Monto entregado'), '1000');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Registrar entrega' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // el modal sigue abierto
  });

  it('anular pide confirmación y distingue las anuladas', async () => {
    const con = remito({ entregas: [entrega(), entrega({ _id: 'e2', monto: 500, anulada: true })], entregado: 1000, saldo: 2000 });
    vi.mocked(remitosApi.getRemito).mockResolvedValue(con);
    vi.mocked(remitosApi.anularEntrega).mockResolvedValue(
      remito({ entregas: [entrega({ anulada: true }), entrega({ _id: 'e2', monto: 500, anulada: true })], entregado: 0, saldo: 3000 }),
    );
    const user = userEvent.setup();
    ui();
    await user.click(await screen.findByRole('button', { name: /Anular entrega de/ }));
    expect(remitosApi.anularEntrega).not.toHaveBeenCalled(); // todavía no: falta confirmar
    await user.click(screen.getByRole('button', { name: 'Sí, anular' }));
    expect(remitosApi.anularEntrega).toHaveBeenCalledWith('r1', 'e1');
    expect((await screen.findAllByText('Anulada')).length).toBe(2);
  });

  it('con el remito cerrado se puede entregar pero no agregar ajustes', async () => {
    vi.mocked(remitosApi.getRemito).mockResolvedValue(remito({ estado: 'cerrado' }));
    ui();
    expect(await screen.findByRole('button', { name: /Registrar entrega/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajuste/ })).not.toBeInTheDocument();
  });
});

describe('detalle del remito: ajustes', () => {
  it('agrega un descuento como monto negativo', async () => {
    vi.mocked(remitosApi.getRemito).mockResolvedValue(remito());
    vi.mocked(remitosApi.agregarAjuste).mockResolvedValue(
      remito({ ajustes: [{ _id: 'a1', concepto: 'Descuento', monto: -200 }], total: 2800, saldo: 2800 }),
    );
    const user = userEvent.setup();
    ui();
    await user.click(await screen.findByRole('button', { name: /^Ajuste/ }));
    await user.click(screen.getByRole('button', { name: 'Resta del total' }));
    await user.click(screen.getByRole('button', { name: 'Descuento' })); // atajo de concepto
    await user.type(screen.getByLabelText('Monto'), '200');
    await user.click(screen.getByRole('button', { name: 'Agregar ajuste' }));

    expect(remitosApi.agregarAjuste).toHaveBeenCalledWith('r1', { concepto: 'Descuento', monto: -200, resaltado: false });
    expect(await screen.findByRole('button', { name: 'Quitar ajuste Descuento' })).toBeInTheDocument();
  });

  it('"Resaltar línea" se envía al servidor y la línea se ve marcada (vacíos devueltos como descuento)', async () => {
    vi.mocked(remitosApi.getRemito).mockResolvedValue(remito());
    vi.mocked(remitosApi.agregarAjuste).mockResolvedValue(
      remito({ ajustes: [{ _id: 'a1', concepto: '5 vacíos devueltos', monto: -15000, resaltado: true }], total: 3000, saldo: 3000 }),
    );
    const user = userEvent.setup();
    ui();
    await user.click(await screen.findByRole('button', { name: /^Ajuste/ }));
    await user.click(screen.getByRole('button', { name: 'Resta del total' }));
    expect(screen.getByRole('switch', { name: /Resaltar línea/ })).not.toBeChecked(); // por defecto no resalta
    await user.type(screen.getByLabelText('Concepto'), '5 vacíos devueltos');
    await user.type(screen.getByLabelText('Monto'), '15000');
    await user.click(screen.getByRole('switch', { name: /Resaltar línea/ }));
    await user.click(screen.getByRole('button', { name: 'Agregar ajuste' }));

    expect(remitosApi.agregarAjuste).toHaveBeenCalledWith('r1', { concepto: '5 vacíos devueltos', monto: -15000, resaltado: true });
    const fila = (await screen.findByText('5 vacíos devueltos')).closest('li')!;
    expect(fila.className).toContain('bg-yellow');
    expect(within(fila).getByText(/15\.000/)).toBeInTheDocument();
  });

  it('rechaza < y > en el concepto y exige monto', async () => {
    vi.mocked(remitosApi.getRemito).mockResolvedValue(remito());
    const user = userEvent.setup();
    ui();
    await user.click(await screen.findByRole('button', { name: /^Ajuste/ }));
    const boton = screen.getByRole('button', { name: 'Agregar ajuste' });
    await user.type(screen.getByLabelText('Concepto'), '<b>x');
    await user.type(screen.getByLabelText('Monto'), '10');
    expect(screen.getByText('No puede contener < ni >')).toBeInTheDocument();
    expect(boton).toBeDisabled();
  });
});

describe('listado y comprobantes', () => {
  const card = (r: any) => render(<MemoryRouter><ul><RemitoCard remito={r} /></ul></MemoryRouter>);
  const resumen = (o = {}): any => { const { items, ajustes, entregas, ...r } = remito(); void items; void ajustes; void entregas; return { ...r, cantidad_items: 1, estado_pago: 'pendiente', ...o }; };

  it('la tarjeta muestra Parcial y cuánto debe; sin entregas no agrega etiquetas', () => {
    card(resumen({ estado_pago: 'parcial', entregado: 1000, saldo: 2000 }));
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText(/Debe/)).toBeInTheDocument();
  });
  it('un remito pendiente no muestra etiqueta de cobro', () => {
    card(resumen());
    expect(screen.queryByText('Parcial')).not.toBeInTheDocument();
    expect(screen.queryByText('Pagado')).not.toBeInTheDocument();
    expect(screen.queryByText(/Debe/)).not.toBeInTheDocument();
  });

  it('el ticket y el PDF se generan con ajustes y entregas (y sin ellos)', () => {
    const con = remito({
      ajustes: [{ _id: 'a', concepto: 'Saldo anterior', monto: 50000 }], entregas: [entrega()], total: 53000, entregado: 1000, saldo: 52000,
    });
    for (const r of [con, remito()]) {
      expect(generarTicketPdf(r).getNumberOfPages()).toBe(1);
      expect(generarRemitoDigitalPdf(r).getNumberOfPages()).toBe(1);
    }
    // ajustes resaltados también se dibujan en ambos formatos
    const resaltado = remito({ ajustes: [{ _id: 'a', concepto: '5 vacíos devueltos', monto: -15000, resaltado: true }, { _id: 'b', concepto: 'Saldo', monto: 10, resaltado: false }], total: 3010, saldo: 3010 });
    expect(generarTicketPdf(resaltado).getNumberOfPages()).toBe(1);
    expect(generarRemitoDigitalPdf(resaltado).getNumberOfPages()).toBe(1);
    // 20 ajustes + productos: pasa a varias hojas sin romperse
    const muchos = remito({ ajustes: Array.from({ length: 25 }, (_, i) => ({ _id: `a${i}`, concepto: `Aj ${i}`, monto: 1 })), total: 3025, saldo: 3025 });
    expect(generarRemitoDigitalPdf(muchos).getNumberOfPages()).toBeGreaterThan(1);
  });
});
