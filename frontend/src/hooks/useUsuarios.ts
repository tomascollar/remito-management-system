import { useCallback, useEffect, useState } from 'react';
import { listUsuarios } from '../api/users';
import { getErrorMessage } from '../lib/errors';
import type { UsuarioAdmin } from '../types/auth';

/** Carga la lista de usuarios (solo superadmin). `reload` vuelve a pedirla. */
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    listUsuarios()
      .then((d) => { if (cancelado) return; setUsuarios(d); setError(null); })
      .catch((e) => { if (!cancelado) setError(getErrorMessage(e, 'No se pudieron cargar los usuarios')); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { usuarios, loading, error, reload };
}
