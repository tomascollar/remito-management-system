import type { EstadoPago, Remito, UnidadVenta } from '../types/remito';

/** Texto de la unidad según la cantidad: 1 bulto / 2 bultos / 1 unidad / 25 unidades. */
export const etiquetaUnidad = (cantidad: number, unidad: UnidadVenta) =>
  unidad === 'bulto'
    ? cantidad === 1 ? 'bulto' : 'bultos'
    : cantidad === 1 ? 'unidad' : 'unidades';

/** Nombre del vendedor si el remito vino con el dato poblado; null si solo vino el id. */
export const nombreVendedor = (r: Pick<Remito, 'vendedor'>) =>
  typeof r.vendedor === 'object' ? r.vendedor.nombre : null;

/*
 * Cambios "locales": reproducen en el navegador lo que va a hacer el backend, para que la
 * pantalla se actualice al instante sin esperar la respuesta. Cuando el servidor responde,
 * su versión reemplaza a esta, así que si hubiera diferencias, gana siempre el servidor.
 */

/** Redondeo a centavos, igual que el servidor. */
export const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Total = productos + ajustes (que pueden ser negativos). */
export const totalDe = (items: Remito['items'], ajustes: Remito['ajustes']) =>
  redondear(items.reduce((acc, it) => acc + it.subtotal, 0) + ajustes.reduce((acc, a) => acc + a.monto, 0));

/** Mismo remito con otros ítems: recalcula el total y el saldo (lo entregado no cambia). */
const conItems = (r: Remito, items: Remito['items']): Remito => {
  const total = totalDe(items, r.ajustes);
  return { ...r, items, total, saldo: redondear(total - r.entregado) };
};

/** Cobro derivado: sin entregas = pendiente; con algo entregado, parcial o pagado según cubra el total. */
export const estadoPagoDe = (total: number, entregado: number): EstadoPago =>
  entregado <= 0 ? 'pendiente' : entregado >= total ? 'pagado' : 'parcial';

/** Entregas vigentes (sin las anuladas). */
export const entregasVigentes = (r: Pick<Remito, 'entregas'>) => r.entregas.filter((e) => !e.anulada);

/** El remito sin ese ítem (y con el total recalculado). */
export const sinItem = (r: Remito, itemId: string): Remito =>
  conItems(r, r.items.filter((it) => it._id !== itemId));

/**
 * Bultos que descuenta una línea con esa cantidad, igual que el servidor: por bulto 1 a 1; por
 * unidad, cantidad ÷ unidades por bulto guardadas en la línea (0 si es una línea vieja sin ese dato).
 */
export const bultosDeLinea = (it: Pick<Remito['items'][number], 'unidad_venta' | 'contenido_por_bulto'>, cantidad: number) =>
  it.unidad_venta === 'bulto'
    ? cantidad
    : it.contenido_por_bulto
      ? Math.round((cantidad / it.contenido_por_bulto + Number.EPSILON) * 1e6) / 1e6
      : 0;

/** El remito con otra cantidad en un ítem: recalcula subtotal, bultos consumidos y total. */
export const conCantidad = (r: Remito, itemId: string, cantidad: number): Remito => {
  const items = r.items.map((it) =>
    it._id !== itemId
      ? it
      : {
          ...it,
          cantidad,
          subtotal: cantidad * it.precio_unitario,
          bultos_consumidos: bultosDeLinea(it, cantidad),
        },
  );
  return conItems(r, items);
};

export const conEstado = (r: Remito, estado: Remito['estado']): Remito => ({ ...r, estado });
