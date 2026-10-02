import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Segmented } from '../../components/ui/Segmented';
import { actualizarPrecio, agregarStock, ajustarStock, registrarStock } from '../../api/stock';
import { getErrorMessage } from '../../lib/errors';
import { formatCantidad } from '../../lib/format';
import {
  agregarSchema,
  ajusteSchema,
  aNumero,
  crearNuevoStockSchema,
  crearPrecioSchema,
  type AgregarValues,
  type AjusteValues,
  type NuevoStockValues,
  type PrecioValues,
} from '../../lib/stockSchemas';
import type { Producto } from '../../types/product';
import type { StockVigente } from '../../types/stock';

interface FormProps {
  producto: Producto;
  stock: StockVigente | null;
  onDone: () => void; // se llama cuando la acción terminó bien (cierra el modal y recarga)
}

/**
 * Ejecuta una acción contra la API. Si funciona llama a onDone; si falla guarda el
 * mensaje para mostrarlo dentro del formulario. Lo comparten los cuatro formularios.
 */
function useAccion(onDone: () => void) {
  const [error, setError] = useState<string | null>(null);

  const ejecutar = async (accion: () => Promise<void>, fallback: string) => {
    setError(null);
    try {
      await accion();
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, fallback));
    }
  };

  return { error, ejecutar };
}

function ErrorBanner({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-50 p-3 text-sm text-danger-700">
      <CircleX size={18} className="mt-0.5 shrink-0" />
      {mensaje}
    </div>
  );
}

/**
 * NUEVO STOCK (llegó el camión). Reemplaza el stock vigente del producto: el anterior
 * pasa a histórico. Por eso, si ya hay stock, se avisa antes de confirmar.
 */
export function NuevoStockForm({ producto, stock, onDone }: FormProps) {
  const fraccionable = producto.permite_venta_fraccionada;
  const schema = useMemo(() => crearNuevoStockSchema(fraccionable), [fraccionable]);
  const { error, ejecutar } = useAccion(onDone);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NuevoStockValues>({
    resolver: zodResolver(schema),
    // Los precios se proponen con los vigentes para no tipearlos de cero cada vez
    defaultValues: {
      cantidad: '',
      precio_bulto: stock ? String(stock.precio_bulto) : '',
      precio_unidad: stock?.precio_unidad ? String(stock.precio_unidad) : '',
    },
  });

  const onSubmit = (v: NuevoStockValues) =>
    ejecutar(
      () =>
        registrarStock({
          producto: producto._id,
          cantidad_bultos_inicial: aNumero(v.cantidad),
          precio_bulto: aNumero(v.precio_bulto),
          // El backend exige precio_unidad solo en productos fraccionables
          ...(fraccionable && { precio_unidad: aNumero(v.precio_unidad) }),
        }),
      'No se pudo registrar el stock',
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <ErrorBanner mensaje={error} />

      {stock && (
        <p className="rounded-2xl bg-warning-50 p-3 text-sm text-warning-700">
          Hoy ya hay {formatCantidad(stock.cantidad_bultos_actual)} bultos. Cargar stock nuevo{' '}
          <strong>reemplaza</strong> el actual (pasa al historial). Si solo llegó más mercadería,
          usá «Agregar».
        </p>
      )}

      <Input
        label="Bultos recibidos"
        inputMode="decimal"
        placeholder="Ej: 10"
        error={errors.cantidad?.message}
        {...register('cantidad')}
      />
      <Input
        label="Precio por bulto"
        inputMode="decimal"
        placeholder="Ej: 12000"
        error={errors.precio_bulto?.message}
        {...register('precio_bulto')}
      />
      {fraccionable && (
        <Input
          label="Precio por unidad"
          inputMode="decimal"
          placeholder="Ej: 700"
          error={errors.precio_unidad?.message}
          {...register('precio_unidad')}
        />
      )}

      <Button type="submit" large loading={isSubmitting} className="w-full">
        {stock ? 'Reemplazar stock' : 'Cargar stock'}
      </Button>
    </form>
  );
}

/** AGREGAR: ingreso adicional de mercadería. Suma al stock actual, no lo reemplaza. */
export function AgregarForm({ producto, onDone }: FormProps) {
  const { error, ejecutar } = useAccion(onDone);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AgregarValues>({
    resolver: zodResolver(agregarSchema),
    defaultValues: { cantidad: '' },
  });

  const onSubmit = (v: AgregarValues) =>
    ejecutar(() => agregarStock(producto._id, aNumero(v.cantidad)), 'No se pudo agregar el stock');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <ErrorBanner mensaje={error} />
      <Input
        label="Bultos a sumar"
        inputMode="decimal"
        placeholder="Ej: 3"
        hint="Ingreso adicional: se suma al stock actual."
        error={errors.cantidad?.message}
        {...register('cantidad')}
      />
      <Button type="submit" large loading={isSubmitting} className="w-full">
        Agregar al stock
      </Button>
    </form>
  );
}

/** PRECIO: cambia los precios vigentes. Los remitos ya generados conservan el suyo. */
export function PrecioForm({ producto, stock, onDone }: FormProps) {
  const fraccionable = producto.permite_venta_fraccionada;
  const schema = useMemo(() => crearPrecioSchema(fraccionable), [fraccionable]);
  const { error, ejecutar } = useAccion(onDone);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PrecioValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      precio_bulto: stock ? String(stock.precio_bulto) : '',
      precio_unidad: stock?.precio_unidad ? String(stock.precio_unidad) : '',
    },
  });

  const onSubmit = (v: PrecioValues) =>
    ejecutar(
      () =>
        actualizarPrecio(producto._id, {
          precio_bulto: aNumero(v.precio_bulto),
          ...(fraccionable && { precio_unidad: aNumero(v.precio_unidad) }),
        }),
      'No se pudo actualizar el precio',
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <ErrorBanner mensaje={error} />
      <Input
        label="Precio por bulto"
        inputMode="decimal"
        error={errors.precio_bulto?.message}
        {...register('precio_bulto')}
      />
      {fraccionable && (
        <Input
          label="Precio por unidad"
          inputMode="decimal"
          error={errors.precio_unidad?.message}
          {...register('precio_unidad')}
        />
      )}
      <p className="text-xs text-muted">Los remitos ya generados mantienen el precio con el que se crearon.</p>
      <Button type="submit" large loading={isSubmitting} className="w-full">
        Guardar precios
      </Button>
    </form>
  );
}

/**
 * AJUSTAR: corrección manual del stock (por ejemplo, para descontar las ventas por unidad,
 * que no tocan el stock en bultos). Se elige sumar o restar y se carga la cantidad en positivo:
 * así no hace falta el signo menos, que el teclado numérico del celular no trae.
 */
export function AjusteForm({ producto, stock, onDone }: FormProps & { stock: StockVigente }) {
  const { error, ejecutar } = useAccion(onDone);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AjusteValues>({
    resolver: zodResolver(ajusteSchema),
    defaultValues: { tipo: 'restar', cantidad: '', observaciones: '' },
  });

  // Vista previa en vivo: cómo quedaría el stock con el ajuste que se está escribiendo
  const [tipo, cantidadTxt] = useWatch({ control, name: ['tipo', 'cantidad'] });
  const n = aNumero(cantidadTxt ?? '');
  const resultado =
    Number.isFinite(n) && n > 0 ? stock.cantidad_bultos_actual + (tipo === 'restar' ? -n : n) : null;

  const onSubmit = (v: AjusteValues) =>
    ejecutar(() => {
      const cantidad = aNumero(v.cantidad);
      return ajustarStock(
        producto._id,
        v.tipo === 'restar' ? -cantidad : cantidad, // el backend espera el valor con signo
        v.observaciones || undefined,
      );
    }, 'No se pudo ajustar el stock');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <ErrorBanner mensaje={error} />

      <Controller
        control={control}
        name="tipo"
        render={({ field }) => (
          <Segmented
            label="Tipo de ajuste"
            value={field.value}
            onChange={field.onChange}
            options={[
              { id: 'restar', label: 'Restar' },
              { id: 'sumar', label: 'Sumar' },
            ]}
          />
        )}
      />

      <Input
        label="Bultos"
        inputMode="decimal"
        placeholder="Ej: 1"
        error={errors.cantidad?.message}
        {...register('cantidad')}
      />

      {resultado !== null &&
        (resultado < 0 ? (
          <p className="text-sm text-danger-700">El stock no puede quedar negativo.</p>
        ) : (
          <p className="text-sm text-muted">
            Stock actual: {formatCantidad(stock.cantidad_bultos_actual)} → quedaría en{' '}
            <strong className="text-ink">{formatCantidad(resultado)}</strong> bultos
          </p>
        ))}

      <Input
        label="Motivo (opcional)"
        placeholder="Ej: ventas por unidad del día"
        error={errors.observaciones?.message}
        {...register('observaciones')}
      />

      <Button type="submit" large loading={isSubmitting} className="w-full">
        Aplicar ajuste
      </Button>
    </form>
  );
}
