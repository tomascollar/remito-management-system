import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, X } from 'lucide-react';
import { getPermisos } from '../../api/laboratorio';
import { getErrorMessage } from '../../lib/errors';
import { etiquetaRol } from '../../lib/usuarioSchemas';
import type { MatrizPermisos as Matriz, PermisoRuta } from '../../types/laboratorio';
import type { Rol } from '../../types/auth';
import { Seccion } from './controles';

/** Agrupa las rutas por recurso: /api/products/:id -> "products". */
const grupoDe = (ruta: string) => ruta.split('/')[2] ?? ruta;

function Celda({ ruta, rol }: { ruta: PermisoRuta; rol: string }) {
  if (!ruta.requiereLogin) return <Minus size={16} className="mx-auto text-muted" aria-label="Público" />;
  const permitido = ruta.roles === null || ruta.roles.includes(rol);
  return permitido ? (
    <Check size={16} className="mx-auto text-success-700" aria-label="Permitido" />
  ) : (
    <X size={16} className="mx-auto text-danger-700" aria-label="Denegado" />
  );
}

/**
 * Matriz de permisos por rol (control de acceso, RBAC). No está escrita a mano: el servidor la
 * calcula leyendo qué middlewares tiene cada ruta registrada, así siempre refleja el código real.
 */
export function MatrizPermisos() {
  const [matriz, setMatriz] = useState<Matriz | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    getPermisos()
      .then((m) => !cancelado && setMatriz(m))
      .catch((e) => !cancelado && setError(getErrorMessage(e, 'No se pudo cargar la matriz')));
    return () => {
      cancelado = true;
    };
  }, []);

  const grupos = useMemo(() => {
    const mapa = new Map<string, PermisoRuta[]>();
    for (const r of matriz?.rutas ?? []) mapa.set(grupoDe(r.ruta), [...(mapa.get(grupoDe(r.ruta)) ?? []), r]);
    return [...mapa.entries()];
  }, [matriz]);

  return (
    <Seccion
      titulo="Permisos: control de acceso por rol"
      descripcion="Qué puede hacer cada rol en cada endpoint de la API. Un usuario sin el rol necesario recibe 403 y el intento queda en el registro."
    >
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
      {!matriz && !error && <p className="text-sm text-muted">Cargando…</p>}
      {matriz && (
        <div className="space-y-3">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Check size={14} className="text-success-700" /> permitido</span>
            <span className="inline-flex items-center gap-1"><X size={14} className="text-danger-700" /> denegado (403)</span>
            <span className="inline-flex items-center gap-1"><Minus size={14} /> público, sin sesión</span>
          </p>
          {grupos.map(([grupo, rutas]) => (
            <details key={grupo} className="rounded-2xl bg-canvas p-3" open={grupo === 'users'}>
              <summary className="cursor-pointer text-sm font-semibold">
                /{grupo} <span className="font-normal text-muted">· {rutas.length} endpoints</span>
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="py-1 pr-3 font-medium">Endpoint</th>
                      {matriz.roles.map((rol) => (
                        <th key={rol} className="px-2 py-1 text-center font-medium">{etiquetaRol(rol as Rol)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rutas.map((r) => (
                      <tr key={`${r.metodo} ${r.ruta}`} className="border-t border-black/5">
                        <td className="py-1.5 pr-3 font-mono text-xs">
                          <span className="mr-2 inline-block w-12 font-semibold">{r.metodo}</span>
                          {r.ruta}
                        </td>
                        {matriz.roles.map((rol) => (
                          <td key={rol} className="px-2 py-1.5">
                            <Celda ruta={r} rol={rol} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </Seccion>
  );
}
