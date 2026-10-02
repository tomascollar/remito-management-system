import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Check, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { AgregarProducto } from './AgregarProducto';
import { EditarCantidad } from './EditarCantidad';
import { EstadoRemito } from './EstadoRemito';
import { agregarItem, cerrarRemito, modificarCantidadItem, quitarItem, reabrirRemito } from '../../api/remitos';
import { useCatalogoVenta } from '../../hooks/useCatalogoVenta';
import { useRemito } from '../../hooks/useRemito';
import { getErrorMessage } from '../../lib/errors';
import { formatFechaHora } from '../../lib/fechas';
import { formatCantidad, formatMoneda } from '../../lib/format';
import { conCantidad, conEstado, etiquetaUnidad, nombreVendedor, sinItem } from '../../lib/remitos';
import type { Producto } from '../../types/product';
import type { Remito, RemitoItem, UnidadVenta } from '../../types/remito';

/** El key={id} reinicia todo el estado al pasar de un remito a otro. */
export default function RemitoDetalle() {
  const { id = '' } = useParams();
  return <Detalle key={id} id={id} />;
}

/**
 * Pantalla de un remito: sirve para armarlo (abierto) y para consultarlo (cerrado).
 *
 * Las acciones (quitar, cambiar cantidad, cerrar, reabrir) se reflejan AL INSTANTE en pantalla
 * y se envían al servidor en segundo plano, de a una y en orden. Cuando la última termina se
 * muestra lo que devolvió el servidor; si alguna falla, se avisa y se vuelve a pedir el remito
 * para mostrar la verdad. Agregar un producto espera la respuesta (hace falta el ítem real).
 */
function Detalle({ id }: { id: string }) {
  const { remito, loading, aplicar, actualizarLocal, reload } = useRemito(id);
  const catalogo = useCatalogoVenta();

  const [agregando, setAgregando] = useState(false);
  const [editando, setEditando] = useState<RemitoItem | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // Cola de envíos: garantiza que el servidor reciba las acciones en el mismo orden en que se tocaron
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const pendientes = useRef(0);

  if (loading) return <p className="py-10 text-center text-sm text-muted">Cargando remito…</p>;

  if (!remito) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-danger-700">No se pudo cargar el remito</p>
        <div className="flex justify-center gap-2">
          <Button variant="soft" onClick={reload}>Reintentar</Button>
          <Link to="/remitos" className="btn btn-ghost">Volver a remitos</Link>
        </div>
      </div>
    );
  }

  const abierto = remito.estado === 'abierto';

  /**
   * Envía una acción al servidor, esperando a que terminen las anteriores. Mientras queden
   * acciones en espera no se pisa la pantalla con respuestas intermedias (se vería "saltar");
   * al terminar la última se muestra la respuesta del servidor, o se re-pide el remito si falló.
   * Devuelve una promesa que se rechaza si esta acción falla.
   */
  const enviar = (accion: () => Promise<Remito>): Promise<void> => {
    pendientes.current += 1;
    const tarea = cola.current.then(async () => {
      try {
        const actualizado = await accion();
        pendientes.current -= 1;
        if (pendientes.current === 0) {
          aplicar(actualizado);
          catalogo.reload();
        }
      } catch (err) {
        pendientes.current -= 1;
        if (pendientes.current === 0) {
          reload(); // volver a lo que de verdad tiene el servidor
          catalogo.reload();
        }
        throw err;
      }
    });
    cola.current = tarea.catch(() => undefined);
    return tarea;
  };

  /** Acción con efecto inmediato en pantalla: se aplica el cambio local y se envía en segundo plano. */
  const rapida = (cambioLocal: (r: Remito) => Remito, accion: () => Promise<Remito>, fallback: string) => {
    setErrorAccion(null);
    actualizarLocal(cambioLocal);
    enviar(accion).catch((err) => setErrorAccion(getErrorMessage(err, fallback)));
  };

  const quitar = (item: RemitoItem) =>
    rapida((r) => sinItem(r, item._id), () => quitarItem(remito._id, item._id), 'No se pudo quitar el producto');

  const cambiarCantidad = (item: RemitoItem, cantidad: number) =>
    rapida(
      (r) => conCantidad(r, item._id, cantidad),
      () => modificarCantidadItem(remito._id, item._id, cantidad),
      'No se pudo cambiar la cantidad',
    );

  const cambiarEstado = (estado: Remito['estado']) =>
    rapida(
      (r) => conEstado(r, estado),
      () => (estado === 'cerrado' ? cerrarRemito(remito._id) : reabrirRemito(remito._id)),
      estado === 'cerrado' ? 'No se pudo cerrar el remito' : 'No se pudo reabrir el remito',
    );

  /** Agregar un ítem: el error se muestra dentro del modal, que es donde se está trabajando. */
  const agregar = (producto: Producto, cantidad: number, unidad: UnidadVenta) =>
    enviar(() => agregarItem(remito._id, { producto: producto._id, cantidad, unidad_venta: unidad }));

  // Bultos libres de un producto, para no dejar sumar más de los que hay (undefined = no se sabe)
  const libres = (productoId: string) =>
    catalogo.filas.find((f) => f.producto._id === productoId)?.stock.cantidad_bultos_actual;

  const vendedor = nombreVendedor(remito);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/remitos" className="btn btn-ghost -ml-3 px-3 py-1.5">
          <ArrowLeft size={18} /> Remitos
        </Link>
        <header className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted">Remito #{remito.numero_remito}</span>
            <EstadoRemito estado={remito.estado} />
          </div>
          <h1 className="text-2xl font-bold">{remito.nombre_cliente}</h1>
          <p className="text-xs text-muted">
            {formatFechaHora(remito.fecha)}
            {vendedor ? ` · ${vendedor}` : ''}
          </p>
        </header>
      </div>

      {remito.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {abierto
            ? 'Todavía no hay productos. Tocá «Agregar» para cargar el primero, o cerrá el remito si no se va a usar.'
            : 'Este remito no tiene productos.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {remito.items.map((item) => {
            const libre = item.unidad_venta === 'bulto' ? libres(item.producto) : undefined;
            const sinStockParaSumar = libre !== undefined && libre < 1;
            return (
              <li key={item._id} className="card space-y-2 p-4">
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 truncate font-semibold">{item.nombre_producto}</p>
                  <p className="shrink-0 font-bold">{formatMoneda(item.subtotal)}</p>
                  {abierto && (
                    <button
                      className="btn btn-ghost -my-1.5 -mr-2 shrink-0 p-2.5"
                      aria-label={`Quitar ${item.nombre_producto}`}
                      title="Quitar"
                      onClick={() => quitar(item)}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                {abierto ? (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <button
                      className="btn btn-soft size-9 p-0"
                      aria-label={`Restar uno a ${item.nombre_producto}`}
                      disabled={item.cantidad <= 1}
                      onClick={() => cambiarCantidad(item, Math.round((item.cantidad - 1) * 100) / 100)}
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      className="min-w-24 cursor-pointer rounded-xl px-2 py-1.5 text-center font-medium text-ink hover:bg-canvas"
                      aria-label={`Cambiar cantidad de ${item.nombre_producto}`}
                      onClick={() => setEditando(item)}
                    >
                      {formatCantidad(item.cantidad)} {etiquetaUnidad(item.cantidad, item.unidad_venta)}
                    </button>
                    <button
                      className="btn btn-soft size-9 p-0"
                      aria-label={`Sumar uno a ${item.nombre_producto}`}
                      disabled={sinStockParaSumar}
                      onClick={() => cambiarCantidad(item, Math.round((item.cantidad + 1) * 100) / 100)}
                    >
                      <Plus size={16} />
                    </button>
                    <span>× {formatMoneda(item.precio_unitario)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    {formatCantidad(item.cantidad)} {etiquetaUnidad(item.cantidad, item.unidad_venta)} ×{' '}
                    {formatMoneda(item.precio_unitario)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Barra fija: total siempre visible y acciones al alcance del pulgar (sobre la barra inferior en celular).
          Los errores van acá y no arriba de la página, para que se vean aunque se haya bajado con el scroll. */}
      <div className="card sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 space-y-3 p-4 md:bottom-4">
        {errorAccion && (
          <p role="alert" className="rounded-2xl bg-danger-50 p-3 text-sm text-danger-700">
            {errorAccion}
          </p>
        )}

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Total</span>
          <span className="text-2xl font-bold">{formatMoneda(remito.total)}</span>
        </div>

        {abierto ? (
          <div className="flex gap-3">
            <Button variant="soft" large className="flex-1" onClick={() => setAgregando(true)}>
              <Plus size={18} /> Agregar
            </Button>
            <Button large className="flex-1" onClick={() => cambiarEstado('cerrado')}>
              <Check size={18} /> Cerrar remito
            </Button>
          </div>
        ) : (
          <Button variant="soft" large className="w-full" onClick={() => cambiarEstado('abierto')}>
            <RotateCcw size={18} /> Reabrir remito
          </Button>
        )}
      </div>

      <Modal open={agregando} title="Agregar producto" onClose={() => setAgregando(false)}>
        {catalogo.loading ? (
          <p className="py-6 text-center text-sm text-muted">Cargando productos…</p>
        ) : catalogo.error ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-danger-700">{catalogo.error}</p>
            <Button variant="soft" onClick={catalogo.reload}>Reintentar</Button>
          </div>
        ) : (
          <AgregarProducto filas={catalogo.filas} onAgregar={agregar} />
        )}
      </Modal>

      <Modal open={!!editando} title="Cambiar cantidad" onClose={() => setEditando(null)}>
        {editando && (
          <EditarCantidad
            item={editando}
            disponible={libres(editando.producto)}
            onGuardar={(cantidad) => {
              cambiarCantidad(editando, cantidad);
              setEditando(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
