import type { EstadoPago } from '../../types/remito';

/**
 * Chip de cobro. "Pendiente" (no se entregó nada) no muestra nada: es el estado normal de un
 * remito nuevo y llenaría la lista de etiquetas. Solo se destaca lo que ya tiene movimiento.
 */
export function EstadoCobro({ estado }: { estado: EstadoPago }) {
  if (estado === 'parcial') {
    return <span className="rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700">Parcial</span>;
  }
  if (estado === 'pagado') {
    return <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700">Pagado</span>;
  }
  return null;
}
