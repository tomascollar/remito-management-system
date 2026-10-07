import { api } from './client';
import type {
  ConfigSeguridad,
  EstadoLaboratorio,
  EventoSeguridad,
  MatrizPermisos,
  MedicionBcrypt,
  ResultadoConsulta,
  ResultadoIntento,
  TokenDemo,
} from '../types/laboratorio';

// ---- Endpoints del laboratorio (solo superadmin, y solo si el servidor tiene SECURITY_LAB=true) ----

export async function getEstado() {
  const { data } = await api.get<EstadoLaboratorio>('/security-lab/estado');
  return data;
}

/** Cambia parámetros de seguridad en vivo. Los contadores de intentos arrancan de cero. */
export async function actualizarConfig(cambios: Partial<ConfigSeguridad>) {
  const { data } = await api.put<{ config: ConfigSeguridad }>('/security-lab/config', cambios);
  return data.config;
}

export async function restaurarConfig() {
  const { data } = await api.post<{ config: ConfigSeguridad }>('/security-lab/config/restaurar');
  return data.config;
}

export async function reiniciarContadores() {
  await api.post('/security-lab/contadores/reiniciar');
}

/** Pide un token de prueba (con la duración indicada) sin tocar la sesión real. */
export async function emitirTokenDemo(duracionSeg: number) {
  const { data } = await api.post<TokenDemo>('/security-lab/token-demo', { duracionSeg });
  return data;
}

export async function medirBcrypt(costo: number) {
  const { data } = await api.post<MedicionBcrypt>('/security-lab/bcrypt', { costo });
  return data;
}

export async function listEventos(desdeId = 0) {
  const { data } = await api.get<{ eventos: EventoSeguridad[] }>('/security-lab/eventos', { params: { desde_id: desdeId } });
  return data.eventos;
}

export async function borrarEventos() {
  await api.delete('/security-lab/eventos');
}

export async function getPermisos() {
  const { data } = await api.get<MatrizPermisos>('/security-lab/permisos');
  return data;
}

// ---- Peticiones "crudas" para las demostraciones ----
// Se hacen con fetch y no con `api` a propósito: `api` puede cerrar la sesión ante un 401 o
// mostrar errores genéricos, y acá justamente queremos ver la respuesta tal cual la da el servidor.

const base = () => api.defaults.baseURL ?? '';

const leerNumero = (valor: string | null) => (valor !== null && valor !== '' && !Number.isNaN(Number(valor)) ? Number(valor) : null);

/** Un intento de login con credenciales falsas: sirve para ver cuándo el limitador empieza a bloquear. */
export async function intentoLoginFalso(numero: number): Promise<ResultadoIntento> {
  const r = await fetch(`${base()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'atacante@laboratorio.local', password: `incorrecta-${numero}` }),
  });
  const cuerpo = (await r.json().catch(() => null)) as { message?: string } | null;
  return {
    estado: r.status,
    restantes: leerNumero(r.headers.get('ratelimit-remaining')),
    limite: leerNumero(r.headers.get('ratelimit-limit')),
    mensaje: cuerpo?.message ?? '',
  };
}

/** Consulta una ruta protegida con un token de demostración y devuelve lo que respondió el servidor. */
export async function consultarConToken(token: string): Promise<ResultadoConsulta> {
  const r = await fetch(`${base()}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } });
  const cuerpo = (await r.json().catch(() => null)) as { message?: string } | null;
  return { estado: r.status, mensaje: r.ok ? 'Token aceptado' : (cuerpo?.message ?? 'Rechazado') };
}
