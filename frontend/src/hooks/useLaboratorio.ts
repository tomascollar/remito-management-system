import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { actualizarConfig, getEstado, restaurarConfig } from '../api/laboratorio';
import { getErrorMessage } from '../lib/errors';
import type { ConfigSeguridad, EstadoLaboratorio } from '../types/laboratorio';

/**
 * Estado del laboratorio (configuración vigente, valores por defecto y rangos permitidos).
 * `desactivado` es true cuando el servidor no tiene SECURITY_LAB=true (la ruta no existe: 404).
 */
export function useLaboratorio() {
  const [estado, setEstado] = useState<EstadoLaboratorio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desactivado, setDesactivado] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    getEstado()
      .then((e) => {
        if (cancelado) return;
        setEstado(e);
        setError(null);
        setDesactivado(false);
      })
      .catch((err) => {
        if (cancelado) return;
        if (isAxiosError(err) && err.response?.status === 404) setDesactivado(true);
        else setError(getErrorMessage(err, 'No se pudo cargar el laboratorio'));
      });
    return () => {
      cancelado = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  /** Aplica cambios en el servidor y actualiza la configuración mostrada. */
  const aplicar = useCallback(async (cambios: Partial<ConfigSeguridad>) => {
    const config = await actualizarConfig(cambios);
    setEstado((e) => (e ? { ...e, config } : e));
  }, []);

  const restaurar = useCallback(async () => {
    const config = await restaurarConfig();
    setEstado((e) => (e ? { ...e, config } : e));
  }, []);

  return { estado, error, desactivado, reload, aplicar, restaurar };
}
