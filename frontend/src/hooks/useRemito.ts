import { useCallback, useEffect, useState } from 'react';
import { getRemito } from '../api/remitos';
import { getErrorMessage } from '../lib/errors';
import type { Remito } from '../types/remito';

/**
 * Carga un remito.
 *  - `aplicar(remito)`: reemplaza el estado con el remito que devuelve el servidor tras una acción.
 *  - `actualizarLocal(fn)`: cambio inmediato en pantalla, antes de que el servidor responda.
 *  - `reload()`: vuelve a pedirlo al servidor sin mostrar "cargando" (para reconciliar).
 * Usar con key={id} en el componente para que cambiar de remito reinicie el estado.
 */
export function useRemito(id: string) {
  const [remito, setRemito] = useState<Remito | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    getRemito(id)
      .then((data) => {
        if (cancelado) return;
        setRemito(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(getErrorMessage(err, 'No se pudo cargar el remito'));
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [id, version]);

  const aplicar = useCallback((nuevo: Remito) => {
    // Las acciones devuelven el vendedor sin poblar (solo el id): se conserva el ya cargado
    setRemito((prev) => ({
      ...nuevo,
      vendedor: prev && typeof prev.vendedor === 'object' ? prev.vendedor : nuevo.vendedor,
    }));
  }, []);

  const actualizarLocal = useCallback((cambio: (r: Remito) => Remito) => {
    setRemito((prev) => (prev ? cambio(prev) : prev));
  }, []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { remito, loading, error, aplicar, actualizarLocal, reload };
}
