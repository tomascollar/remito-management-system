import { createContext } from 'react';
import type { Usuario } from '../types/auth';

export interface AuthContextValue {
  usuario: Usuario | null;
  loading: boolean;
  errorConexion: boolean; // no se pudo verificar la sesión porque el servidor no responde
  reintentar: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);