/**
 * Cálculos de dinero de un remito: total, entregado y saldo.
 *
 * Son funciones puras (no tocan la base) para poder probarlas solas y usar la misma
 * cuenta en el modelo, los controladores y el listado.
 */

/** Redondea a centavos para que sumas como 0.1 + 0.2 no dejen 0.30000000000000004. */
export const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

interface ConMonto {
  monto: number;
  anulada?: boolean;
}

/** Suma de las entregas vigentes. Las anuladas no cuentan. */
export const totalEntregado = (entregas: ConMonto[] | undefined | null): number =>
  redondear((entregas ?? []).filter((e) => !e.anulada).reduce((acc, e) => acc + e.monto, 0));

/** Total del remito = subtotales de los productos + ajustes (que pueden ser negativos). */
export const calcularTotal = (
  items: { subtotal: number }[] | undefined | null,
  ajustes: { monto: number }[] | undefined | null
): number =>
  redondear(
    (items ?? []).reduce((acc, it) => acc + it.subtotal, 0) +
      (ajustes ?? []).reduce((acc, aj) => acc + aj.monto, 0)
  );

export type EstadoPago = 'pendiente' | 'parcial' | 'pagado';

/**
 * Estado de cobro derivado (no se guarda):
 *  - pendiente: no se entregó nada
 *  - parcial:   se entregó algo pero falta
 *  - pagado:    lo entregado cubre el total
 */
export const estadoPago = (total: number, entregado: number): EstadoPago => {
  if (entregado <= 0) return 'pendiente';
  return entregado >= total ? 'pagado' : 'parcial';
};
