import { useMemo, useState } from 'react';
import { Package, Pencil, Plus, Power, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ProductoForm } from './ProductoForm';
import { useProductos } from '../../hooks/useProductos';
import { setProductoActivo } from '../../api/products';
import { getErrorMessage } from '../../lib/errors';
import type { Producto } from '../../types/product';

type Filtro = 'activos' | 'inactivos' | 'todos';

const filtros: { id: Filtro; label: string }[] = [
  { id: 'activos', label: 'Activos' },
  { id: 'inactivos', label: 'Inactivos' },
  { id: 'todos', label: 'Todos' },
];

// Minúsculas y sin tildes, para que "aji" encuentre "Ají"
const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export default function Productos() {
  const { productos, loading, error, reload } = useProductos();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('activos');
  // null = modal cerrado; { producto: null } = alta; { producto } = edición
  const [modal, setModal] = useState<{ producto: Producto | null } | null>(null);
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // Aplica el filtro de estado y la búsqueda (por nombre o categoría)
  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return productos.filter((p) => {
      if (filtro === 'activos' && !p.activo) return false;
      if (filtro === 'inactivos' && p.activo) return false;
      return !q || normalizar(`${p.nombre} ${p.categoria ?? ''}`).includes(q);
    });
  }, [productos, busqueda, filtro]);

  /** Desactiva o reactiva un producto (baja lógica, reversible) y refresca la lista. */
  const cambiarEstado = async (p: Producto) => {
    setPendienteId(p._id);
    setErrorAccion(null);
    try {
      await setProductoActivo(p._id, !p.activo);
      reload();
    } catch (err) {
      setErrorAccion(getErrorMessage(err, 'No se pudo cambiar el estado del producto'));
    } finally {
      setPendienteId(null);
    }
  };

  const guardado = () => {
    setModal(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted">Catálogo de productos y cómo se venden.</p>
        </div>
        <Button onClick={() => setModal({ producto: null })}>
          <Plus size={18} /> Nuevo
        </Button>
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
                filtro === id
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface text-muted ring-1 ring-black/5 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {errorAccion && (
        <p role="alert" className="rounded-2xl bg-danger-50 p-3 text-sm text-danger-700">
          {errorAccion}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando productos…</p>
      ) : error ? (
        <div className="space-y-3 py-10 text-center">
          <p className="text-sm text-danger-700">{error}</p>
          <Button variant="soft" onClick={reload}>Reintentar</Button>
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {productos.length === 0 ? 'Todavía no hay productos. Creá el primero.' : 'No hay productos que coincidan.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((p) => (
            <li key={p._id} className="card flex items-center gap-4 p-4">
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
                  p.activo ? 'bg-primary-50 text-primary-700' : 'bg-canvas text-muted'
                }`}
              >
                <Package size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold ${p.activo ? '' : 'text-muted'}`}>{p.nombre}</p>
                <p className="truncate text-xs text-muted">
                  {[p.categoria, p.unidad_stock].filter(Boolean).join(' · ')}
                </p>
                {p.permite_venta_fraccionada && (
  <span className="mt-1.5 inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
    Fraccionable{p.cantidad_por_bulto ? ` · aprox. ${p.cantidad_por_bulto} por bulto` : ''}
  </span>
)}
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  className="btn btn-ghost p-2.5"
                  aria-label={`Editar ${p.nombre}`}
                  title="Editar"
                  onClick={() => setModal({ producto: p })}
                >
                  <Pencil size={18} />
                </button>
                <button
                  className="btn btn-ghost p-2.5"
                  aria-label={`${p.activo ? 'Desactivar' : 'Reactivar'} ${p.nombre}`}
                  title={p.activo ? 'Desactivar' : 'Reactivar'}
                  disabled={pendienteId === p._id}
                  onClick={() => cambiarEstado(p)}
                >
                  <Power size={18} className={p.activo ? '' : 'text-primary-600'} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!modal}
        title={modal?.producto ? 'Editar producto' : 'Nuevo producto'}
        onClose={() => setModal(null)}
      >
        {modal && <ProductoForm producto={modal.producto} onSaved={guardado} />}
      </Modal>
    </div>
  );
}