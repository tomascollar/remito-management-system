import { useState } from 'react';
import { Segmented } from '../../components/ui/Segmented';
import { formatCantidad, formatMoneda } from '../../lib/format';
import { AjusteForm, NuevoStockForm, PrecioForm } from './StockForms';
import type { FilaStock } from '../../types/stock';

export type Accion = 'nuevo' | 'precio' | 'ajuste';

interface Props {
  fila: FilaStock;
  accionInicial: Accion;
  onDone: () => void;
}

/**
 * Contenido del modal de gestión: resumen del producto y las acciones posibles.
 * Un producto sin stock cargado solo puede recibir "Nuevo"; las demás acciones
 * necesitan un stock vigente (el backend responde 404 si no existe).
 */
export function GestionStock({ fila, accionInicial, onDone }: Props) {
  const { producto, stock } = fila;
  const [accion, setAccion] = useState<Accion>(stock ? accionInicial : 'nuevo');

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-canvas p-4 text-sm">
        {stock ? (
          <>
            <p className="font-medium">
              {formatCantidad(stock.cantidad_bultos_actual)} de {formatCantidad(stock.cantidad_bultos_inicial)}{' '}
              bultos
            </p>
            <p className="text-muted">
              Bulto {formatMoneda(stock.precio_bulto)}
              {stock.precio_unidad ? ` · Unidad ${formatMoneda(stock.precio_unidad)}` : ''}
              {stock.precio_unidad_x_bulto ? ` · P.UxB ${formatMoneda(stock.precio_unidad_x_bulto)}` : ''}
            </p>
          </>
        ) : (
          <p className="text-muted">Todavía no hay stock cargado para este producto.</p>
        )}
      </div>

      {stock && (
        <Segmented<Accion>
          label="Acción"
          value={accion}
          onChange={setAccion}
          options={[
            { id: 'ajuste', label: 'Ajustar' },
            { id: 'precio', label: 'Precio' },
            { id: 'nuevo', label: 'Nuevo' },
          ]}
        />
      )}

      {accion === 'nuevo' && <NuevoStockForm producto={producto} stock={stock} onDone={onDone} />}
      {accion === 'precio' && stock && <PrecioForm producto={producto} stock={stock} onDone={onDone} />}
      {accion === 'ajuste' && stock && <AjusteForm producto={producto} stock={stock} onDone={onDone} />}
    </div>
  );
}
