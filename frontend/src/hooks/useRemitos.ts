import { useCallback, useEffect, useState } from 'react';
import { listRemitos } from '../api/remitos';
import { getErrorMessage } from '../lib/errors';
import { inicioDeHoy } from '../lib/fechas';
import type { Remito } from '../types/remito';

interface Opciones {
  estado?: 'abierto' | 'cerrado';
  soloHoy?: boolean;
}

/** Lista de remitos con filtro por estado y/o "solo hoy". `reload()` vuelve a pedirla. */
export function useRemitos({ estado, soloHoy }: Opciones = {}) {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    // La fecha se calcula acá adentro (no en el render) para no depender de la hora en cada render
    listRemitos({ estado, desde: soloHoy ? inicioDeHoy() : undefined })
      .then((data) => {
        if (cancelado) return;
        setRemitos(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(getErrorMessage(err, 'No se pudieron cargar los remitos'));
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [estado, soloHoy, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { remitos, loading, error, reload };
}
