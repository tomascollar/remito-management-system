import axios from 'axios';
import { tokenStorage } from '../lib/tokenStorage';

let unauthorizedHandler: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  unauthorizedHandler = fn;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15000, // si el servidor no responde en 15 s, la acción falla en lugar de quedar colgada
});

// Adjunta el token a cada request
api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el backend responde 401 (token vencido, inválido o usuario inactivo), se cierra la sesión
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const esLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !esLogin) unauthorizedHandler?.();
    return Promise.reject(error);
  },
);