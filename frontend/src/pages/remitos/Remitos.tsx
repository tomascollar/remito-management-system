import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { RemitoCard } from './RemitoCard';
import { useAuth } from '../../context/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { useRemitos } from '../../hooks/useRemitos';

type Filtro = 'abiertos' | 'hoy' | 'todos';

const filtros: { id: Filtro; label: string }[] = [
  { id: 'abiertos', label: 'Abiertos' },
  { id: 'hoy', label: 'Hoy' },
  { id: 'todos', label: 'Todos' },
];

const chip = (activo: boolean) =>
  `cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition ${
    activo ? 'bg-primary-600 text-white' : 'bg-surface text-muted ring-1 ring-black/5 hover:text-ink'
  }`;

/**
 * Listado de remitos. Todo se resuelve en el servidor (estado, fecha, vendedor y búsqueda por
 * cliente o número) y se carga de a páginas, así sigue rápido aunque haya miles de remitos.
 */
export default function Remitos() {
  const { usuario } = useAuth();
  const [filtro, setFiltro] = useState<Filtro>('abiertos');
  const [soloMios, setSoloMios] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  // Se busca al dejar de escribir, no en cada tecla
  const q = useDebounce(busqueda.trim(), 350);

  const { remitos, total, loading, actualizando, error, hayMas, cargandoMas, errorMas, cargarMas, reload } = useRemitos({
    estado: filtro === 'abiertos' ? 'abierto' : undefined,
    soloHoy: filtro === 'hoy',
    vendedor: soloMios ? usuario?.id : undefined,
    q,
  });

  const hayFiltros = q !== '' || soloMios || filtro !== 'todos';

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Remitos</h1>
          <p className="text-sm text-muted">Consultá y corregí los remitos.</p>
        </div>
        <Link to="/nuevo-remito" className="btn btn-primary">
          <Plus size={18} /> Nuevo
        </Link>
      </header>

      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-11 pr-11"
            placeholder="Buscar por cliente o número"
            aria-label="Buscar por cliente o número"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-muted hover:text-ink"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {filtros.map(({ id, label }) => (
            <button key={id} onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={chip(filtro === id)}>
              {label}
            </button>
          ))}
          <button onClick={() => setSoloMios((v) => !v)} aria-pressed={soloMios} className={chip(soloMios)}>
            Míos
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando remitos…</p>
      ) : error && remitos.length === 0 ? (
        <div className="space-y-3 py-10 text-center">
          <p className="text-sm text-danger-700">{error}</p>
          <Button variant="soft" onClick={reload}>Reintentar</Button>
        </div>
      ) : remitos.length === 0 && !actualizando ? (
        <p className="py-10 text-center text-sm text-muted">
          {hayFiltros ? 'No hay remitos que coincidan.' : 'No hay remitos para mostrar.'}
        </p>
      ) : (
        <div className={`space-y-3 transition-opacity ${actualizando ? 'opacity-60' : ''}`}>
          {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
          <p className="text-xs text-muted">
            {total} {total === 1 ? 'remito' : 'remitos'}
            {hayMas ? ` · mostrando ${remitos.length}` : ''}
          </p>
          <ul className="space-y-3">
            {remitos.map((r) => (
              <RemitoCard key={r._id} remito={r} />
            ))}
          </ul>
          {errorMas && <p role="alert" className="text-center text-sm text-danger-700">{errorMas}</p>}
          {hayMas && (
            <div className="flex justify-center pt-1">
              <Button variant="soft" loading={cargandoMas} onClick={cargarMas}>
                Cargar más
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
