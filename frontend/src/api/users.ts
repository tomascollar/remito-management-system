import { api } from './client';
import type { Rol, UsuarioAdmin } from '../types/auth';

/** Datos para crear un usuario. */
export interface NuevoUsuarioInput { nombre: string; email: string; password: string; rol: Rol }

/** Cambios parciales: solo se envían los campos presentes (la clave es opcional). */
export type CambiosUsuario = Partial<{ nombre: string; email: string; password: string; rol: Rol; activo: boolean }>;

export async function listUsuarios() {
  const { data } = await api.get<UsuarioAdmin[]>('/users');
  return data;
}

export async function crearUsuario(input: NuevoUsuarioInput) {
  await api.post('/users', input);
}

/** Edita datos, rol, contraseña o estado (activo) de un usuario. */
export async function actualizarUsuario(id: string, cambios: CambiosUsuario) {
  await api.put(`/users/${id}`, cambios);
}
