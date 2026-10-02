import { useState } from 'react';
import { Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { UsuarioForm } from './UsuarioForm';
import { actualizarUsuario } from '../../api/users';
import { useAuth } from '../../context/useAuth';
import { useUsuarios } from '../../hooks/useUsuarios';
import { getErrorMessage } from '../../lib/errors';
import { etiquetaRol } from '../../lib/usuarioSchemas';
import type { UsuarioAdmin } from '../../types/auth';

/** Qué diálogo está abierto: alta, edición de un usuario, o confirmación de desactivar. */
type Dialogo = { tipo: 'nuevo' } | { tipo: 'editar'; usuario: UsuarioAdmin } | { tipo: 'desactivar'; usuario: UsuarioAdmin } | null;

/** Administración de usuarios (solo superadmin). Se desactiva en vez de borrar para conservar el historial de remitos. */
export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const { usuarios, loading, error, reload } = useUsuarios();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cerrar = () => { setDialogo(null); setErrorAccion(null); };
  const terminado = () => { cerrar(); reload(); };

  /** Activa o desactiva un usuario. La desactivación invalida su sesión en el próximo request. */
  const cambiarEstado = async (u: UsuarioAdmin, activo: boolean) => {
    setProcesando(true);
    setErrorAccion(null);
    try {
      await actualizarUsuario(u._id, { activo });
      terminado();
    } catch (err) {
      setErrorAccion(getErrorMessage(err, 'No se pudo cambiar el estado del usuario'));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted">Quién puede entrar al sistema y con qué rol.</p>
        </div>
        <Button onClick={() => setDialogo({ tipo: 'nuevo' })}><Plus size={18} /> Nuevo</Button>
      </header>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando usuarios…</p>
      ) : error ? (
        <div className="space-y-3 py-10 text-center">
          <p className="text-sm text-danger-700">{error}</p>
          <Button variant="soft" onClick={reload}>Reintentar</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {usuarios.map((u) => {
            const esPropio = u._id === yo?.id;
            return (
              <li key={u._id} className={`card flex items-center gap-3 p-4 ${u.activo ? '' : 'opacity-60'}`}>
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
                  {u.nombre.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {u.nombre}{esPropio && <span className="ml-2 text-xs font-normal text-muted">(vos)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                  <div className="mt-1 flex gap-2">
                    <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted">{etiquetaRol(u.rol)}</span>
                    {!u.activo && <span className="rounded-full bg-danger-50 px-2.5 py-0.5 text-xs font-medium text-danger-700">Inactivo</span>}
                  </div>
                </div>
                <button aria-label={`Editar ${u.nombre}`} className="btn btn-ghost" onClick={() => setDialogo({ tipo: 'editar', usuario: u })}>
                  <Pencil size={18} />
                </button>
                {/* Nadie puede desactivarse a sí mismo: quedaría sin acceso */}
                {!esPropio && (u.activo ? (
                  <button aria-label={`Desactivar ${u.nombre}`} className="btn btn-ghost" onClick={() => setDialogo({ tipo: 'desactivar', usuario: u })}>
                    <UserX size={18} />
                  </button>
                ) : (
                  <button aria-label={`Activar ${u.nombre}`} className="btn btn-ghost" disabled={procesando} onClick={() => cambiarEstado(u, true)}>
                    <UserCheck size={18} />
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={dialogo?.tipo === 'nuevo'} title="Nuevo usuario" onClose={cerrar}>
        <UsuarioForm onDone={terminado} />
      </Modal>

      <Modal open={dialogo?.tipo === 'editar'} title="Editar usuario" onClose={cerrar}>
        {dialogo?.tipo === 'editar' && (
          <UsuarioForm usuario={dialogo.usuario} esPropio={dialogo.usuario._id === yo?.id} onDone={terminado} />
        )}
      </Modal>

      <Modal open={dialogo?.tipo === 'desactivar'} title="Desactivar usuario" onClose={cerrar}>
        {dialogo?.tipo === 'desactivar' && (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{dialogo.usuario.nombre}</strong> ya no va a poder ingresar. Sus remitos se conservan y podés
              reactivarlo cuando quieras.
            </p>
            {errorAccion && <p role="alert" className="text-sm text-danger-700">{errorAccion}</p>}
            <div className="flex gap-3">
              <Button variant="soft" className="flex-1" onClick={cerrar}>Cancelar</Button>
              <Button className="flex-1" loading={procesando} onClick={() => cambiarEstado(dialogo.usuario, false)}>Desactivar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
