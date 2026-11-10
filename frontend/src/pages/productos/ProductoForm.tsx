import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { createProducto, updateProducto } from '../../api/products';
import { getErrorMessage } from '../../lib/errors';
import { productoSchema, type ProductoFormValues } from '../../lib/schemas';
import type { Producto, ProductoInput } from '../../types/product';
import { Select } from '../../components/ui/Select';
import { CATEGORIAS, aCatalogo } from '../../lib/catalogos';
//import { Segmented } from '../../components/ui/Segmented';

interface Props {
  producto: Producto | null; // null = alta de un producto nuevo
  onSaved: () => void;
}

/**
 * Convierte los valores del formulario al formato de la API.
 * `cantidad_por_bulto` es obligatorio si el producto es fraccionable (lo valida el esquema y el
 * backend). Si no es fraccionable se envía null y el backend borra el dato guardado.
 */
function toPayload(v: ProductoFormValues): ProductoInput {
  const contenido = v.cantidad_por_bulto.replace(',', '.');
  return {
    nombre: v.nombre,
    categoria: v.categoria,
    permite_venta_fraccionada: v.permite_venta_fraccionada,
    cantidad_por_bulto: v.permite_venta_fraccionada && contenido ? Number(contenido) : null,
  };
}

export function ProductoForm({ producto, onSaved }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema),
    defaultValues: {
      nombre: producto?.nombre ?? '',
      categoria: aCatalogo(producto?.categoria, CATEGORIAS),
      permite_venta_fraccionada: producto?.permite_venta_fraccionada ?? false,
      cantidad_por_bulto: producto?.cantidad_por_bulto ? String(producto.cantidad_por_bulto) : '',
    },
  });

  // El campo "unidades por bulto" solo tiene sentido si el producto es fraccionable
  const fraccionable = useWatch({ control, name: 'permite_venta_fraccionada' });

  const onSubmit = async (values: ProductoFormValues) => {
    setServerError(null);
    try {
      const payload = toPayload(values);
      if (producto) await updateProducto(producto._id, payload);
      else await createProducto(payload);
      onSaved();
    } catch (err) {
      setServerError(getErrorMessage(err, 'No se pudo guardar el producto'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-danger-50 p-3 text-sm text-danger-700"
        >
          <CircleX size={18} className="mt-0.5 shrink-0" />
          {serverError}
        </div>
      )}

      <Input label="Nombre" placeholder="Ej: Tomate perita" error={errors.nombre?.message} {...register('nombre')} />

      <Select
        label="Categoría (opcional)"
        options={CATEGORIAS}
        placeholder="Sin categoría"
        error={errors.categoria?.message}
        {...register('categoria')}
      />


<Toggle
  label="Permite venta fraccionada"
  hint="Se puede vender por unidad, además de por bulto. Cada unidad vendida descuenta del stock la fracción de bulto que le corresponde."
  {...register('permite_venta_fraccionada')}
/>

      {fraccionable && (
        <Input
          label="Unidades por bulto"
          inputMode="decimal"
          placeholder="Ej: 10"
          hint="Se usa para descontar el stock: con 10 por bulto, vender 11 unidades descuenta 1,1 bultos."
          error={errors.cantidad_por_bulto?.message}
          {...register('cantidad_por_bulto')}
        />
      )}

      <Button type="submit" large loading={isSubmitting} className="w-full">
        {producto ? 'Guardar cambios' : 'Crear producto'}
      </Button>
    </form>
  );
}