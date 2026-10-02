import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { AuthContext } from './auth-context';
import { login, getProfile } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { tokenStorage } from '../lib/tokenStorage';
import type { Usuario } from '../types/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(() => !!tokenStorage.get());
  const [errorConexion, setErrorConexion] = useState(false);
  const [intento, setIntento] = useState(0); // cambia al reintentar y vuelve a ejecutar la verificación

  const signOut = useCallback(() => {
    tokenStorage.clear();
    setUsuario(null);
  }, []);

  // Al cargar la app: si hay token guardado, se valida contra el backend.
  useEffect(() => {
    if (!tokenStorage.get()) return;
    let cancelado = false;

    getProfile()
      .then((u) => {
        if (!cancelado) setUsuario(u);
      })
      .catch((err) => {
        if (cancelado) return;
        // Servidor caído o sin red (sin respuesta o 5xx): el token puede seguir siendo
        // válido, así que NO se cierra la sesión; se avisa y se permite reintentar.
        // Cualquier 4xx significa token inválido, vencido o usuario inactivo: se limpia.
        const servidorCaido = isAxiosError(err) && (!err.response || err.response.status >= 500);
        if (servidorCaido) setErrorConexion(true);
        else tokenStorage.clear();
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [intento]);

  // Cualquier 401 posterior cierra la sesión.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const reintentar = useCallback(() => {
    setErrorConexion(false);
    setLoading(true);
    setIntento((n) => n + 1);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await login(email, password);
    tokenStorage.set(data.token);
    setUsuario(data.usuario);
  }, []);

  const value = useMemo(
    () => ({ usuario, loading, errorConexion, reintentar, signIn, signOut }),
    [usuario, loading, errorConexion, reintentar, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}