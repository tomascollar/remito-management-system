import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { RemitoCard } from './RemitoCard';
import { useRemitos } from '../../hooks/useRemitos';
import { normalizar } from '../../lib/format';

type Filtro = 'abiertos' | 'hoy' | 'todos';

const filtros: { id: Filtro; label: string }[] = [
  { id: 'abiertos', label: 'Abiertos' },
  { id: 'hoy', label: 'Hoy' },
  { id: 'todos', label: 'Todos' },
];

/** Listado de remitos. El filtro de estado/fecha lo resuelve el backend; la búsqueda, el cliente. */
export default function Remitos() {
  const [filtro, setFiltro] = useState<Filtro>('abiertos');
  const [busqueda, setBusqueda] = useState('');

  const { remitos, loading, error, reload } = useRemitos({
    estado: filtro === 'abiertos' ? 'abierto' : undefined,
    soloHoy: filtro === 'hoy',
  });

  // Busca por nombre de cliente o por número de remito ("12" o "#12")
  const visibles = useMemo(() => {
    const q = normalizar(busqueda).replace('#', '').trim();
    if (!q) return remitos;
    return remitos.filter((r) => normalizar(`${r.numero_remito} ${r.nombre_cliente}`).includes(q));
  }, [remitos, busqueda]);

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
            className="input pl-11"
            placeholder="Buscar por cliente o número"
            aria-label="Buscar por cliente o número"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {filtros.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filtro === id ? 'bg-primary-600 text-white' : 'bg-surface text-muted ring-1 ring-black/5 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando remitos…</p>
      ) : error ? (
        <div className="space-y-3 py-10 text-center">
          <p className="text-sm text-danger-700">{error}</p>
          <Button variant="soft" onClick={reload}>Reintentar</Button>
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {remitos.length === 0 ? 'No hay remitos para mostrar.' : 'No hay remitos que coincidan.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((r) => (
            <RemitoCard key={r._id} remito={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
