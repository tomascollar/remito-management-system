export type Rol = 'superadmin' | 'administrador' | 'vendedor';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface LoginResponse {
  message: string;
  token: string;
  usuario: Usuario;
}

   export interface UsuarioAdmin { _id: string; nombre: string; email: string;
     rol: Rol; activo: boolean; createdAt: string; }