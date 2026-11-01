import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Boxes, History, Search, Settings2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { GestionStock, type Accion } from './GestionStock';
import { useAuth } from '../../context/useAuth';
import { useProductos } from '../../hooks/useProductos';
import { useStock } from '../../hooks/useStock';
import { formatCantidad, formatMoneda, normalizar } from '../../lib/format';
import type { FilaStock, StockVigente } from '../../types/stock';

type Filtro = 'todos' | 'con' | 'sin';

const filtros: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'con', label: 'Con stock' },
  { id: 'sin', label: 'Sin stock' },
];

// Por debajo de este porcentaje del stock inicial se marca como "stock bajo"
const UMBRAL_BAJO = 0.25;

/**
 * Estado visual de un stock: agotado, bajo o normal. Es solo una ayuda visual
 * calculada sobre lo cargado al inicio; no cambia ninguna regla de negocio.
 */
function estadoStock(stock: StockVigente) {
  const { cantidad_bultos_actual: actual, cantidad_bultos_inicial: inicial } = stock;
  const porcentaje = inicial > 0 ? Math.min(100, (actual / inicial) * 100) : 0;
  if (actual <= 0) return { etiqueta: 'Agotado', chip: 'bg-danger-50 text-danger-700', barra: 'bg-danger-500', porcentaje };
  if (actual / inicial <= UMBRAL_BAJO)
    return { etiqueta: 'Stock bajo', chip: 'bg-warning-50 text-warning-700', barra: 'bg-warning-500', porcentaje };
  return { etiqueta: null, chip: '', barra: 'bg-primary-500', porcentaje };
}

export default function Stock() {
  const { usuario } = useAuth();
  // Cargar y modificar stock es solo para administración; el vendedor consulta
  const puedeGestionar = usuario?.rol === 'superadmin' || usuario?.rol === 'administrador';

  const productos = useProductos();
  const stock = useStock();

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  // null = modal cerrado
  const [modal, setModal] = useState<{ fila: FilaStock; accion: Accion } | null>(null);

  /**
   * Une los dos orígenes de datos: cada producto ACTIVO con su stock vigente (o null si
   * todavía no se cargó). Se parte de los productos y no del stock, así los productos
   * desactivados desaparecen de la pantalla y los que no tienen stock se pueden cargar.
   */
  const filas = useMemo<FilaStock[]>(() => {
    const porProducto = new Map<string, StockVigente>();
    for (const s of stock.items) if (s.producto) porProducto.set(s.producto._id, s);
    return productos.productos
      .filter((p) => p.activo)
      .map((p) => ({ producto: p, stock: porProducto.get(p._id) ?? null }));
  }, [productos.productos, stock.items]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return filas.filter(({ producto, stock: s }) => {
      const conStock = !!s && s.cantidad_bultos_actual > 0;
      if (filtro === 'con' && !conStock) return false;
      if (filtro === 'sin' && conStock) return false;
      return !q || normalizar(`${producto.nombre} ${producto.categoria ?? ''}`).includes(q);
    });
  }, [filas, busqueda, filtro]);

  const loading = productos.loading || stock.loading;
  const error = productos.error ?? stock.error;
  const recargar = () => {
    productos.reload();
    stock.reload();
  };

  const terminado = () => {
    setModal(null);
    recargar();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Stock</h1>
          <p className="text-sm text-muted">Stock vigente y precios de cada producto.</p>
        </div>
        {puedeGestionar && (
          <Link to="/historial-stock" className="btn btn-soft shrink-0">
            <History size={18} /> Historial
          </Link>
        )}
      </header>

      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-11"
            placeholder="Buscar por nombre o categoría"
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
        <p className="py-10 text-center text-sm text-muted">Cargando stock…</p>
      ) : error ? (
        <div className="space-y-3 py-10 text-center">
          <p className="text-sm text-danger-700">{error}</p>
          <Button variant="soft" onClick={recargar}>Reintentar</Button>
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {filas.length === 0 ? 'No hay productos activos. Creá productos primero.' : 'No hay productos que coincidan.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((fila) => {
            const { producto, stock: s } = fila;
            const estado = s ? estadoStock(s) : null;
            return (
              <li key={producto._id} className="card space-y-3 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                    <Boxes size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{producto.nombre}</p>
                    <p className="truncate text-xs text-muted">
                      {[producto.categoria, producto.unidad_stock].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  {puedeGestionar && (
                    <Button
                      variant="soft"
                      className="shrink-0 px-3.5 py-2"
                      onClick={() => setModal({ fila, accion: s ? 'ajuste' : 'nuevo' })}
                    >
                      {s ? <Settings2 size={16} /> : null}
                      {s ? 'Gestionar' : 'Cargar stock'}
                    </Button>
                  )}
                </div>

                {s && estado ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p>
                        <span className="font-semibold">{formatCantidad(s.cantidad_bultos_actual)}</span>
                        <span className="text-muted"> de {formatCantidad(s.cantidad_bultos_inicial)} bultos</span>
                      </p>
                      {estado.etiqueta && (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estado.chip}`}>
                          {estado.etiqueta}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                      <div className={`h-full rounded-full ${estado.barra}`} style={{ width: `${estado.porcentaje}%` }} />
                    </div>
                    <p className="text-xs text-muted">
                      Bulto {formatMoneda(s.precio_bulto)}
                      {s.precio_unidad ? ` · Unidad ${formatMoneda(s.precio_unidad)}` : ''}
                      {s.precio_unidad_x_bulto ? ` · P.UxB ${formatMoneda(s.precio_unidad_x_bulto)}` : ''}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted">Sin stock cargado</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!modal} title={modal?.fila.producto.nombre ?? ''} onClose={() => setModal(null)}>
        {modal && <GestionStock fila={modal.fila} accionInicial={modal.accion} onDone={terminado} />}
      </Modal>
    </div>
  );
}
