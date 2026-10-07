import { useState } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useEventosSeguridad } from '../../hooks/useEventosSeguridad';
import { TIPOS_EVENTO, formatHora } from '../../lib/laboratorio';
import type { TipoEvento } from '../../types/laboratorio';
import { Seccion } from './controles';

type Grupo = 'todos' | 'logins' | 'bloqueos' | 'tokens' | 'accesos';

const GRUPOS: { id: Grupo; label: string; tipos: TipoEvento[] | null }[] = [
  { id: 'todos', label: 'Todos', tipos: null },
  { id: 'logins', label: 'Logins', tipos: ['login_ok', 'login_fallido'] },
  { id: 'bloqueos', label: 'Bloqueos', tipos: ['login_bloqueado', 'peticiones_bloqueadas'] },
  { id: 'tokens', label: 'Tokens', tipos: ['token_expirado', 'token_invalido'] },
  { id: 'accesos', label: 'Accesos denegados', tipos: ['acceso_denegado'] },
];

const chip = (activo: boolean) =>
  `cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition ${
    activo ? 'bg-primary-600 text-white' : 'bg-surface text-muted ring-1 ring-black/5 hover:text-ink'
  }`;

/**
 * Registro de eventos de seguridad en vivo (auditoría): inicios de sesión, bloqueos, tokens
 * rechazados, accesos denegados y cambios de configuración. Se actualiza solo cada 2 segundos.
 */
export function RegistroEventos() {
  const [siguiendo, setSiguiendo] = useState(true);
  const [grupo, setGrupo] = useState<Grupo>('todos');
  const { eventos, vaciar } = useEventosSeguridad(siguiendo);

  const tipos = GRUPOS.find((g) => g.id === grupo)?.tipos ?? null;
  const visibles = tipos ? eventos.filter((e) => tipos.includes(e.tipo)) : eventos;

  return (
    <Seccion
      titulo="Registro de eventos de seguridad"
      descripcion="Todo lo que importa para auditar: quién intentó entrar, qué se bloqueó y qué se rechazó. Se actualiza solo. No se guardan contraseñas ni tokens."
    >
      <div className="flex flex-wrap items-center gap-2">
        {GRUPOS.map(({ id, label }) => (
          <button key={id} onClick={() => setGrupo(id)} aria-pressed={grupo === id} className={chip(grupo === id)}>
            {label}
          </button>
        ))}
        <span className="flex-1" />
        <Button variant="soft" onClick={() => setSiguiendo((s) => !s)}>
          {siguiendo ? <><Pause size={16} /> Pausar</> : <><Play size={16} /> Seguir</>}
        </Button>
        <Button variant="soft" onClick={() => void vaciar()}>
          <Trash2 size={16} /> Vaciar
        </Button>
      </div>

      {visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Todavía no hay eventos para mostrar.</p>
      ) : (
        <ul className="max-h-96 space-y-1 overflow-y-auto rounded-2xl bg-canvas p-2" aria-label="Eventos de seguridad">
          {visibles.map((e) => {
            const { etiqueta, chip: color } = TIPOS_EVENTO[e.tipo];
            return (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-xl px-2 py-1.5 text-sm">
                <span className="font-mono text-xs text-muted">{formatHora(e.fecha)}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{etiqueta}</span>
                <span className="min-w-0 flex-1 break-words">{e.detalle}</span>
                {e.ip && <span className="font-mono text-xs text-muted">{e.ip}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Seccion>
  );
}
