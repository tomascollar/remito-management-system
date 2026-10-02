import { api } from './client';
import type { LoginResponse, Usuario } from '../types/auth';

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

// /auth/profile devuelve el documento de Mongo (_id), lo mapeamos a Usuario
export async function getProfile(): Promise<Usuario> {
  const { data } = await api.get('/auth/profile');
  return { id: data._id, nombre: data.nombre, email: data.email, rol: data.rol };
}