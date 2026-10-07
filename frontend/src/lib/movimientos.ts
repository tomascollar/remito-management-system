import type { TipoMovimiento } from '../types/stock';

/** Cómo se muestra cada tipo de movimiento: nombre y colores del chip. */
export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, { etiqueta: string; chip: string }> = {
  stock_inicial: { etiqueta: 'Carga de stock', chip: 'bg-primary-50 text-primary-700' },
  entrada_adicional: { etiqueta: 'Ingreso adicional', chip: 'bg-success-50 text-success-700' },
  ajuste: { etiqueta: 'Ajuste manual', chip: 'bg-warning-50 text-warning-700' },
  venta: { etiqueta: 'Venta', chip: 'bg-canvas text-muted' },
  devolucion: { etiqueta: 'Devolución', chip: 'bg-success-50 text-success-700' },
};

/** Orden en que se ofrecen en el selector de tipo. */
export const ORDEN_TIPOS: TipoMovimiento[] = ['venta', 'devolucion', 'stock_inicial', 'entrada_adicional', 'ajuste'];

/** 4 -> "+4", -2 -> "−2" (con el signo menos tipográfico), 1.5 -> "+1,5". */
export const formatDelta = (n: number) => {
  const abs = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Math.abs(n));
  return `${n > 0 ? '+' : '−'}${abs}`;
};
