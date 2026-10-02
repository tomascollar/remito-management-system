import { Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/useAuth';
import type { Rol } from '../types/auth';

export function ProtectedRoute({ roles }: { roles?: Rol[] }) {
  const { usuario, loading, errorConexion, reintentar } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted">Cargando…</div>;
  }

  // El servidor no respondió al verificar la sesión: no se manda al login (la sesión
  // sigue guardada), se ofrece reintentar.
  if (errorConexion && !usuario) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="card max-w-sm space-y-4 p-8 text-center">
          <p className="font-semibold">No se pudo conectar con el servidor</p>
          <p className="text-sm text-muted">
            Tu sesión sigue guardada. Revisá la conexión e intentá de nuevo.
          </p>
          <Button onClick={reintentar}>Reintentar</Button>
        </div>
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;

  return <Outlet />;
}