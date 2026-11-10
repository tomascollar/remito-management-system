/**
 * Conversión entre unidades y bultos para la venta fraccionada.
 *
 * Regla de negocio: vender por unidad descuenta del stock la fracción de bulto equivalente.
 * Ejemplo: 11 remolachas con 10 por bulto descuentan 1,1 bultos. El contenido por bulto es
 * el del producto, y queda guardado en la línea del remito al momento de la venta.
 */

// Se redondea a 6 decimales para que las sumas y restas repetidas (1,1 + 0,3333…) no vayan
// acumulando ruido de punto flotante en el stock.
const FACTOR = 1e6;

/** Redondeo de bultos a 6 decimales. */
export const redondearBultos = (n: number): number => Math.round((n + Number.EPSILON) * FACTOR) / FACTOR;

/** Bultos equivalentes a una cantidad de unidades: 11 u. con 10 por bulto = 1,1 bultos. */
export const bultosDeUnidades = (unidades: number, contenidoPorBulto: number): number =>
  redondearBultos(unidades / contenidoPorBulto);

/**
 * Bultos que debe tener descontados una línea del remito con esa cantidad.
 * - Por bulto: 1 a 1.
 * - Por unidad: cantidad ÷ contenido guardado en la línea.
 * - Línea por unidad sin contenido (vendida antes de este control): no movió stock, sigue en 0.
 */
export const bultosDeLinea = (unidadVenta: string, cantidad: number, contenidoPorBulto?: number | null): number => {
  if (unidadVenta === 'bulto') return redondearBultos(cantidad);
  return contenidoPorBulto ? bultosDeUnidades(cantidad, contenidoPorBulto) : 0;
};

/** Para mostrar "se necesitan X bultos" sin quedarse corto: redondea hacia arriba a 2 decimales. */
export const bultosParaMensaje = (n: number): number => Math.ceil(n * 100 - 1e-9) / 100;
