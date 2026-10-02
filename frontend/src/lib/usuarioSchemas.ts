import { z } from 'zod';

export const ROLES = [
  { id: 'superadmin', label: 'Superadmin' },
  { id: 'administrador', label: 'Administrador' },
  { id: 'vendedor', label: 'Vendedor' },
] as const;

export const etiquetaRol = (rol: string) => ROLES.find((r) => r.id === rol)?.label ?? rol;

const rol = z.enum(['superadmin', 'administrador', 'vendedor']);
const nombre = z.string().trim().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres')
  .refine((v) => !/[<>]/.test(v), 'No se permiten los caracteres < y >');
const email = z.string().trim().email('Email inválido');

/** Alta: la contraseña es obligatoria (mínimo 8, igual que el backend). */
export const crearUsuarioSchema = z.object({
  nombre, email, rol,
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

/** Edición: la contraseña es opcional; vacía significa "no cambiarla". */
export const editarUsuarioSchema = z.object({
  nombre, email, rol,
  password: z.string().refine((v) => v === '' || v.length >= 8, 'Mínimo 8 caracteres'),
});

export type CrearUsuarioValues = z.infer<typeof crearUsuarioSchema>;
export type EditarUsuarioValues = z.infer<typeof editarUsuarioSchema>;
