import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { actualizarUsuario, crearUsuario } from '../../api/users';
import { getErrorMessage } from '../../lib/errors';
import { crearUsuarioSchema, editarUsuarioSchema, ROLES, type CrearUsuarioValues } from '../../lib/usuarioSchemas';
import type { UsuarioAdmin } from '../../types/auth';

interface Props {
  /** Si viene, el formulario edita ese usuario; si no, crea uno nuevo. */
  usuario?: UsuarioAdmin;
  /** true si el usuario editado es el que tiene la sesión abierta: no puede cambiarse su propio rol. */
  esPropio?: boolean;
  onDone: () => void;
}

/**
 * Alta y edición de usuarios en un mismo formulario.
 * En edición solo se mandan al backend los campos que cambiaron, y la contraseña
 * únicamente si se escribió una nueva (vacía = no cambiarla).
 */
export function UsuarioForm({ usuario, esPropio = false, onDone }: Props) {
  const editando = !!usuario;
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CrearUsuarioValues>({
    resolver: zodResolver(editando ? editarUsuarioSchema : crearUsuarioSchema),
    defaultValues: {
      nombre: usuario?.nombre ?? '',
      email: usuario?.email ?? '',
      rol: usuario?.rol ?? 'vendedor',
      password: '',
    },
  });

  const onSubmit = async (v: CrearUsuarioValues) => {
    setError(null);
    try {
      if (usuario) {
        const cambios: Parameters<typeof actualizarUsuario>[1] = {};
        if (v.nombre !== usuario.nombre) cambios.nombre = v.nombre;
        if (v.email.toLowerCase() !== usuario.email) cambios.email = v.email;
        if (v.rol !== usuario.rol) cambios.rol = v.rol;
        if (v.password) cambios.password = v.password;
        if (Object.keys(cambios).length > 0) await actualizarUsuario(usuario._id, cambios);
      } else {
        await crearUsuario(v);
      }
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, editando ? 'No se pudo guardar el usuario' : 'No se pudo crear el usuario'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-50 p-3 text-sm text-danger-700">
          <CircleX size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      <Input label="Nombre" autoComplete="off" error={errors.nombre?.message} {...register('nombre')} />
      <Input label="Email" type="email" autoComplete="off" error={errors.email?.message} {...register('email')} />
      <Input
        label={editando ? 'Nueva contraseña' : 'Contraseña'}
        type="password"
        autoComplete="new-password"
        hint={editando ? 'Dejala vacía para mantener la actual' : 'Mínimo 8 caracteres'}
        error={errors.password?.message}
        {...register('password')}
      />
      <div className="space-y-1.5">
        <label htmlFor="rol" className="text-sm font-medium">Rol</label>
        <select id="rol" className="input" disabled={esPropio} {...register('rol')}>
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        {esPropio && <p className="text-xs text-muted">No podés cambiar tu propio rol.</p>}
      </div>
      <Button type="submit" large loading={isSubmitting} className="w-full">
        {editando ? 'Guardar cambios' : 'Crear usuario'}
      </Button>
    </form>
  );
}
