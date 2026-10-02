import type { Remito, UnidadVenta } from '../types/remito';

/** Texto de la unidad según la cantidad: 1 bulto / 2 bultos / 1 unidad / 25 unidades. */
export const etiquetaUnidad = (cantidad: number, unidad: UnidadVenta) =>
  unidad === 'bulto'
    ? cantidad === 1 ? 'bulto' : 'bultos'
    : cantidad === 1 ? 'unidad' : 'unidades';

/** Nombre del vendedor si el remito vino con el dato poblado; null si solo vino el id. */
export const nombreVendedor = (r: Remito) =>
  typeof r.vendedor === 'object' ? r.vendedor.nombre : null;

/*
 * Cambios "locales": reproducen en el navegador lo que va a hacer el backend, para que la
 * pantalla se actualice al instante sin esperar la respuesta. Cuando el servidor responde,
 * su versión reemplaza a esta, así que si hubiera diferencias, gana siempre el servidor.
 */

const sumar = (items: Remito['items']) => items.reduce((acc, it) => acc + it.subtotal, 0);

/** El remito sin ese ítem (y con el total recalculado). */
export const sinItem = (r: Remito, itemId: string): Remito => {
  const items = r.items.filter((it) => it._id !== itemId);
  return { ...r, items, total: sumar(items) };
};

/** El remito con otra cantidad en un ítem: recalcula subtotal, bultos consumidos y total. */
export const conCantidad = (r: Remito, itemId: string, cantidad: number): Remito => {
  const items = r.items.map((it) =>
    it._id !== itemId
      ? it
      : {
          ...it,
          cantidad,
          subtotal: cantidad * it.precio_unitario,
          bultos_consumidos: it.unidad_venta === 'bulto' ? cantidad : 0,
        },
  );
  return { ...r, items, total: sumar(items) };
};

export const conEstado = (r: Remito, estado: Remito['estado']): Remito => ({ ...r, estado });
