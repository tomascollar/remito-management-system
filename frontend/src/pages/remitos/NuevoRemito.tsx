import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CircleX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { RemitoCard } from './RemitoCard';
import { crearRemito } from '../../api/remitos';
import { useRemitos } from '../../hooks/useRemitos';
import { getErrorMessage } from '../../lib/errors';
import { clienteSchema, type ClienteValues } from '../../lib/remitoSchemas';

/**
 * Paso 1 de una venta: se crea el remito solo con el nombre del cliente y se pasa
 * directo a su pantalla de edición, donde se cargan los productos. Debajo se listan
 * los remitos abiertos, para retomar uno en curso en lugar de crear otro.
 */
export default function NuevoRemito() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const abiertos = useRemitos({ estado: 'abierto' });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClienteValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { nombre_cliente: '' },
  });

  const onSubmit = async ({ nombre_cliente }: ClienteValues) => {
    setServerError(null);
    try {
      const remito = await crearRemito(nombre_cliente);
      navigate(`/remitos/${remito._id}`);
    } catch (err) {
      setServerError(getErrorMessage(err, 'No se pudo crear el remito'));
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Nuevo remito</h1>
        <p className="text-sm text-muted">Empezá indicando para quién es. Los productos se cargan después.</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-5 p-6 md:max-w-lg">
        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-50 p-3 text-sm text-danger-700">
            <CircleX size={18} className="mt-0.5 shrink-0" />
            {serverError}
          </div>
        )}
        <Input
          label="Cliente"
          placeholder="Nombre del cliente"
          autoComplete="off"
          error={errors.nombre_cliente?.message}
          {...register('nombre_cliente')}
        />
        <Button type="submit" large loading={isSubmitting} className="w-full">
          Crear remito <ArrowRight size={18} />
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Remitos abiertos</h2>
        {abiertos.loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : abiertos.error ? (
          <div className="space-y-2">
            <p className="text-sm text-danger-700">{abiertos.error}</p>
            <Button variant="soft" onClick={abiertos.reload}>Reintentar</Button>
          </div>
        ) : abiertos.remitos.length === 0 ? (
          <p className="text-sm text-muted">No hay remitos abiertos.</p>
        ) : (
          <ul className="space-y-3">
            {abiertos.remitos.map((r) => (
              <RemitoCard key={r._id} remito={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
