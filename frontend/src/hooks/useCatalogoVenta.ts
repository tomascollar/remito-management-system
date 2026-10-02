import { useCallback, useMemo } from 'react';
import { useProductos } from './useProductos';
import { useStock } from './useStock';
import type { FilaVenta } from '../types/remito';

/**
 * Productos que se pueden vender: activos y con stock vigente cargado, ordenados por nombre.
 * Une los dos orígenes (productos y stock). `reload()` refresca ambos, y conviene llamarlo
 * después de cada venta para que las cantidades disponibles se actualicen.
 */
export function useCatalogoVenta() {
  const { productos, loading: cargandoProductos, error: errorProductos, reload: recargarProductos } = useProductos();
  const { items, loading: cargandoStock, error: errorStock, reload: recargarStock } = useStock();

  const filas = useMemo<FilaVenta[]>(() => {
    const activos = new Map(productos.filter((p) => p.activo).map((p) => [p._id, p]));
    const resultado: FilaVenta[] = [];
    for (const stock of items) {
      const producto = stock.producto && activos.get(stock.producto._id);
      if (producto) resultado.push({ producto, stock });
    }
    return resultado.sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, 'es'));
  }, [productos, items]);

  const reload = useCallback(() => {
    recargarProductos();
    recargarStock();
  }, [recargarProductos, recargarStock]);

  return {
    filas,
    loading: cargandoProductos || cargandoStock,
    error: errorProductos ?? errorStock,
    reload,
  };
}
