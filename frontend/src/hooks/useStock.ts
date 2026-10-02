import { useCallback, useEffect, useState } from 'react';
import { listStock } from '../api/stock';
import { getErrorMessage } from '../lib/errors';
import type { StockVigente } from '../types/stock';

/**
 * Carga el stock vigente. `reload()` lo vuelve a pedir (por ejemplo, después de una
 * acción) sin volver a mostrar "cargando", para que la lista no parpadee.
 */
export function useStock() {
  const [items, setItems] = useState<StockVigente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false; // evita actualizar estado si el componente ya se desmontó
    listStock()
      .then((data) => {
        if (cancelado) return;
        setItems(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(getErrorMessage(err, 'No se pudo cargar el stock'));
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { items, loading, error, reload };
}
