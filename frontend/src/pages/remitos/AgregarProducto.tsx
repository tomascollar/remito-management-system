import { useMemo, useState } from 'react';
import { CircleCheck, CircleX, ChevronLeft, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { CantidadStepper } from '../../components/ui/CantidadStepper';
import { Segmented } from '../../components/ui/Segmented';
import { getErrorMessage } from '../../lib/errors';
import { formatCantidad, formatMoneda, normalizar } from '../../lib/format';
import { etiquetaUnidad } from '../../lib/remitos';
import { aNumero } from '../../lib/stockSchemas';
import type { Producto } from '../../types/product';
import type { FilaVenta, UnidadVenta } from '../../types/remito';

interface Props {
  filas: FilaVenta[];
  /**
   * Agrega el ítem al remito. `xBulto` indica que se vende por unidad al precio P.UxB.
   * Debe lanzar el error si falla, para mostrarlo en el formulario.
   */
  onAgregar: (producto: Producto, cantidad: number, unidad: UnidadVenta, xBulto: boolean) => Promise<void>;
}

/**
 * Contenido del modal "Agregar producto": primero se elige el producto de una lista con
 * búsqueda y, al elegirlo, se indica cuánto. Después de agregar vuelve a la lista (con un
 * aviso) para poder cargar varios productos seguidos sin cerrar el modal.
 */
export function AgregarProducto({ filas, onAgregar }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [elegidaId, setElegidaId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Se busca en la lista actual (y no se guarda la fila) para ver siempre el stock al día
  const elegida = filas.find((f) => f.producto._id === elegidaId) ?? null;

  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return filas.filter(
      ({ producto }) => !q || normalizar(`${producto.nombre} ${producto.categoria ?? ''}`).includes(q),
    );
  }, [filas, busqueda]);

  if (elegida) {
    return (
      <CantidadForm
        fila={elegida}
        onVolver={() => setElegidaId(null)}
        onAgregar={async (cantidad, unidad, xBulto) => {
          await onAgregar(elegida.producto, cantidad, unidad, xBulto);
          setAviso(`Agregado: ${formatCantidad(cantidad)} ${etiquetaUnidad(cantidad, unidad)} de ${elegida.producto.nombre}`);
          setElegidaId(null);
          setBusqueda('');
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {aviso && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-success-50 p-3 text-sm text-success-700">
          <CircleCheck size={18} className="shrink-0" />
          {aviso}
        </p>
      )}

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input pl-11"
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No hay productos con stock cargado. Cargalo desde la pantalla de Stock.
        </p>
      ) : visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No hay productos que coincidan.</p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((fila) => {
            const { producto, stock } = fila;
            // Sin stock en bultos solo se puede vender por unidad (si el producto lo permite)
            const bloqueado = !producto.permite_venta_fraccionada && stock.cantidad_bultos_actual <= 0;
            return (
              <li key={producto._id}>
                <button
                  type="button"
                  disabled={bloqueado}
                  onClick={() => {
                    setAviso(null);
                    setElegidaId(producto._id);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-canvas p-4 text-left transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{producto.nombre}</span>
                    <span className="block truncate text-xs text-muted">
                      Bulto {formatMoneda(stock.precio_bulto)}
                      {stock.precio_unidad ? ` · Unidad ${formatMoneda(stock.precio_unidad)}` : ''}
                      {stock.precio_unidad_x_bulto ? ` · P.UxB ${formatMoneda(stock.precio_unidad_x_bulto)}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 text-sm font-medium ${stock.cantidad_bultos_actual <= 0 ? 'text-danger-700' : ''}`}>
                    {stock.cantidad_bultos_actual <= 0 ? 'Sin stock' : `${formatCantidad(stock.cantidad_bultos_actual)} bultos`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface CantidadProps {
  fila: FilaVenta;
  onVolver: () => void;
  onAgregar: (cantidad: number, unidad: UnidadVenta, xBulto: boolean) => Promise<void>;
}

/** Cómo se vende: por bulto, por unidad (precio común) o por unidad a precio P.UxB. */
type Modo = 'bulto' | 'unidad' | 'x_bulto';

/**
 * Elegir bulto o unidad (si el producto es fraccionable) y la cantidad, con botones
 * grandes de +/- pensados para el celular. Si el producto ya está en el remito con el mismo
 * precio, el backend suma esta cantidad a esa línea. Muestra el subtotal en vivo y avisa si se
 * pide más bultos de los que hay.
 */
function CantidadForm({ fila, onVolver, onAgregar }: CantidadProps) {
  const { producto, stock } = fila;
  const fraccionable = producto.permite_venta_fraccionada;

  const [modo, setModo] = useState<Modo>('bulto');
  const [texto, setTexto] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cantidad = aNumero(texto);
  const valida = Number.isFinite(cantidad) && cantidad > 0;
  // P.UxB se vende por unidad: a la API le llega unidad_venta 'unidad' + el indicador xBulto
  const unidad: UnidadVenta = modo === 'bulto' ? 'bulto' : 'unidad';
  const xBulto = modo === 'x_bulto';
  const precio =
    modo === 'bulto' ? stock.precio_bulto : modo === 'x_bulto' ? (stock.precio_unidad_x_bulto ?? 0) : (stock.precio_unidad ?? 0);
  const sinPrecio = modo === 'unidad' && !stock.precio_unidad;
  // Solo las ventas por bulto descuentan (y por lo tanto verifican) el stock
  const excede = modo === 'bulto' && valida && cantidad > stock.cantidad_bultos_actual;

  const enviar = async () => {
    if (!valida || excede || sinPrecio) return;
    setEnviando(true);
    setError(null);
    try {
      await onAgregar(cantidad, unidad, xBulto);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo agregar el producto'));
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={onVolver} className="btn btn-ghost -ml-3 px-3 py-1.5">
        <ChevronLeft size={18} /> Volver a la lista
      </button>

      <div>
        <p className="text-lg font-bold">{producto.nombre}</p>
        <p className="text-sm text-muted">
          Hay {formatCantidad(stock.cantidad_bultos_actual)} bultos · {producto.unidad_stock}
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-50 p-3 text-sm text-danger-700">
          <CircleX size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {fraccionable && (
        <Segmented<Modo>
          label="Vender por"
          value={modo}
          onChange={setModo}
          options={[
            { id: 'bulto', label: `Bulto · ${formatMoneda(stock.precio_bulto)}` },
            { id: 'unidad', label: `Unidad · ${stock.precio_unidad ? formatMoneda(stock.precio_unidad) : '—'}` },
            // P.UxB: precio de unidad al llevar bulto o cantidad grande; solo si el producto lo tiene cargado
            ...(stock.precio_unidad_x_bulto
              ? [{ id: 'x_bulto' as const, label: `P.UxB · ${formatMoneda(stock.precio_unidad_x_bulto)}` }]
              : []),
          ]}
        />
      )}

      <CantidadStepper value={texto} onChange={setTexto} />

      {excede && (
        <p className="text-sm text-danger-700">
          Solo hay {formatCantidad(stock.cantidad_bultos_actual)} bultos disponibles.
        </p>
      )}
      {sinPrecio && <p className="text-sm text-danger-700">Este producto no tiene precio por unidad cargado.</p>}
      {modo !== 'bulto' && !sinPrecio && (
        <p className="text-xs text-muted">La venta por unidad no descuenta bultos del stock.</p>
      )}

      <div className="flex items-baseline justify-between rounded-2xl bg-canvas p-4">
        <span className="text-sm text-muted">Subtotal</span>
        <span className="text-xl font-bold">{valida ? formatMoneda(cantidad * precio) : '—'}</span>
      </div>

      <Button large className="w-full" loading={enviando} disabled={!valida || excede || sinPrecio} onClick={enviar}>
        Agregar al remito
      </Button>
    </div>
  );
}
