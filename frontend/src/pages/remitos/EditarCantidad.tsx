import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { CantidadStepper } from '../../components/ui/CantidadStepper';
import { formatCantidad, formatMoneda } from '../../lib/format';
import { etiquetaUnidad } from '../../lib/remitos';
import { aNumero } from '../../lib/stockSchemas';
import type { RemitoItem } from '../../types/remito';

interface Props {
  item: RemitoItem;
  /** Bultos libres en stock (sin contar los que ya tiene este ítem); undefined si no se sabe. */
  disponible?: number;
  onGuardar: (cantidad: number) => void;
}

/**
 * Contenido del modal "Cambiar cantidad" de un ítem. Limita la cantidad a lo que ya tiene el
 * ítem más lo que haya libre en stock: en ítems por bulto, en bultos; en ítems por unidad, en
 * unidades (bultos libres × unidades por bulto de la venta). El precio no cambia: se conserva
 * el de la venta. El cambio se aplica al instante, por eso guardar no es asincrónico.
 */
export function EditarCantidad({ item, disponible, onGuardar }: Props) {
  const [texto, setTexto] = useState(String(item.cantidad).replace('.', ','));

  const cantidad = aNumero(texto);
  const valida = Number.isFinite(cantidad) && cantidad > 0;
  // Líneas por unidad viejas (sin contenido guardado) no descuentan stock: no tienen tope
  const maximo =
    disponible === undefined
      ? undefined
      : item.unidad_venta === 'bulto'
        ? item.cantidad + disponible
        : item.contenido_por_bulto
          ? item.cantidad + Math.floor(disponible * item.contenido_por_bulto + 1e-9)
          : undefined;
  const excede = valida && maximo !== undefined && cantidad > maximo;
  const etiqueta = item.unidad_venta === 'bulto' ? 'bultos' : 'unidades';

  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-bold">{item.nombre_producto}</p>
        <p className="text-sm text-muted">
          {formatMoneda(item.precio_unitario)} por {item.unidad_venta} · ahora {formatCantidad(item.cantidad)}{' '}
          {etiquetaUnidad(item.cantidad, item.unidad_venta)}
        </p>
      </div>

      <CantidadStepper value={texto} onChange={setTexto} />

      {excede && (
        <p className="text-sm text-danger-700">Como máximo podés tener {formatCantidad(maximo!)} {etiqueta}.</p>
      )}

      <div className="flex items-baseline justify-between rounded-2xl bg-canvas p-4">
        <span className="text-sm text-muted">Subtotal</span>
        <span className="text-xl font-bold">{valida ? formatMoneda(cantidad * item.precio_unitario) : '—'}</span>
      </div>

      <Button large className="w-full" disabled={!valida || excede} onClick={() => onGuardar(cantidad)}>
        Guardar cantidad
      </Button>
    </div>
  );
}
