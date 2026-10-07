import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useMovimientos, type Periodo } from '../../hooks/useMovimientos';
import { useProductos } from '../../hooks/useProductos';
import { formatFechaHora } from '../../lib/fechas';
import { ORDEN_TIPOS, TIPOS_MOVIMIENTO, formatDelta } from '../../lib/movimientos';
import type { MovimientoStock, TipoMovimiento } from '../../types/stock';

const periodos: { id: Periodo; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: 'todo', label: 'Todo' },
];

const chip = (activo: boolean) =>
  `cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition ${
    activo ? 'bg-primary-600 text-white' : 'bg-surface text-muted ring-1 ring-black/5 hover:text-ink'
  }`;

/** Una fila del historial: qué producto, cuántos bultos, de qué tipo, quién y cuándo. */
function FilaMovimiento({ mov }: { mov: MovimientoStock }) {
  const { etiqueta, chip: colorChip } = TIPOS_MOVIMIENTO[mov.tipo];
  const entra = mov.cantidad_bultos > 0;

  return (
    <li className="card space-y-1 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{mov.producto?.nombre ?? 'Producto eliminado'}</p>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorChip}`}>{etiqueta}</span>
        </div>
        <p className={`shrink-0 text-lg font-bold ${entra ? 'text-success-700' : 'text-danger-700'}`}>
          {formatDelta(mov.cantidad_bultos)} <span className="text-xs font-medium text-muted">bultos</span>
        </p>
      </div>
      {mov.observaciones && <p className="text-sm text-muted">{mov.observaciones}</p>}
      <p className="text-xs text-muted">
        {formatFechaHora(mov.fecha)}
        {mov.usuario ? ` · ${mov.usuario.nombre}` : ''}
        {mov.remito && (
          <>
            {' · '}
            <Link to={`/remitos/${mov.remito._id}`} className="font-medium text-primary-700 hover:underline">
              Remito #{mov.remito.numero_remito}
            </Link>
          </>
        )}
      </p>
    </li>
  );
}

/**
 * Historial de movimientos de stock (auditoría): quién cambió el stock, cuándo y por qué.
 * Solo lectura. Los filtros se resuelven en el servidor y se carga de a páginas.
 */
export default function HistorialStock() {
  const [tipo, setTipo] = useState<TipoMovimiento | ''>('');
  const [producto, setProducto] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>('7d');

  const { productos } = useProductos();
  const { movimientos, total, loading, actualizando, error, hayMas, cargandoMas, errorMas, cargarMas, reload } =
    useMovimientos({ tipo: tipo || undefined, producto: producto || undefined, periodo });

  const hayFiltros = tipo !== '' || producto !== '' || periodo !== 'todo';

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link to="/stock" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={16} /> Stock
        </Link>
        <h1 className="text-2xl font-bold">Historial de stock</h1>
        <p className="text-sm text-muted">Quién modificó el stock, cuándo y por qué.</p>
      </header>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="input" aria-label="Producto" value={producto} onChange={(e) => setProducto(e.target.value)}>
            <option value="">Todos los productos</option>
            {productos.map((p) => (
              <option key={p._id} value={p._id}>{p.nombre}</option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Tipo de movimiento"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMovimiento | '')}
          >
            <option value="">Todos los movimientos</option>
            {ORDEN_TIPOS.map((t) => (
              <option key={t} value={t}>{TIPOS_MOVIMIENTO[t].etiqueta}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodos.map(({ id, label }) => (
            <button key={id} onClick={() => setPeriodo(id)} aria-pressed={periodo === id} className={chip(periodo === id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando historial…</p>
      ) : error && movimientos.length === 0 ? (
        <div className="space-y-3 py-10 text-center">
          <p className="text-sm text-danger-700">{error}</p>
          <Button variant="soft" onClick={reload}>Reintentar</Button>
        </div>
      ) : movimientos.length === 0 && !actualizando ? (
        <p className="py-10 text-center text-sm text-muted">
          {hayFiltros ? 'No hay movimientos que coincidan.' : 'Todavía no hay movimientos registrados.'}
        </p>
      ) : (
        <div className={`space-y-3 transition-opacity ${actualizando ? 'opacity-60' : ''}`}>
          {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
          <p className="text-xs text-muted">
            {total} {total === 1 ? 'movimiento' : 'movimientos'}
            {hayMas ? ` · mostrando ${movimientos.length}` : ''}
          </p>
          <ul className="space-y-3">
            {movimientos.map((m) => (
              <FilaMovimiento key={m._id} mov={m} />
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
