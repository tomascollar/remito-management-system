import { useCallback, useEffect, useState } from 'react';
import { listProductos } from '../api/products';
import { getErrorMessage } from '../lib/errors';
import type { Producto } from '../types/product';

/**
 * Carga la lista de productos. `reload()` la vuelve a pedir (por ejemplo, después de
 * guardar) sin volver a mostrar el estado de "cargando", para que la lista no parpadee.
 */
export function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false; // evita actualizar estado si el componente ya se desmontó
    listProductos()
      .then((data) => {
        if (cancelado) return;
        setProductos(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(getErrorMessage(err, 'No se pudieron cargar los productos'));
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { productos, loading, error, reload };
}