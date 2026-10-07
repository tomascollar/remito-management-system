/**
 * Registro de eventos de seguridad (logins, bloqueos, tokens rechazados, accesos denegados…).
 *
 * Es un buffer circular en memoria: guarda solo los últimos MAXIMO eventos, así un ataque
 * que genere miles de intentos no puede llenar la memoria del servidor. Al reiniciar el
 * servidor se pierde. (Mejora futura: persistirlo en MongoDB con un índice TTL.)
 *
 * Nunca se registran contraseñas ni tokens: solo quién, desde dónde y qué pasó.
 */

export type TipoEvento =
  | 'login_ok'
  | 'login_fallido'
  | 'login_bloqueado' // el limitador de login cortó el intento
  | 'peticiones_bloqueadas' // el limitador general cortó la petición
  | 'token_expirado'
  | 'token_invalido'
  | 'acceso_denegado' // usuario autenticado sin el rol necesario (403)
  | 'config_cambiada'
  | 'contadores_reiniciados';

export interface EventoSeguridad {
  id: number; // creciente: permite pedir solo "los eventos nuevos desde el id X"
  fecha: string; // ISO
  tipo: TipoEvento;
  detalle: string;
  ip?: string;
  usuario?: string;
}

interface DatosEvento {
  detalle: string;
  ip?: string;
  usuario?: string;
}

const MAXIMO = 500;
const LARGO_MAXIMO_DETALLE = 200;
let buffer: EventoSeguridad[] = [];
let siguienteId = 1;

/** Recorta texto que puede venir del cliente (ej. un email) para que un atacante no inunde el log. */
const recortar = (texto: string) => (texto.length > LARGO_MAXIMO_DETALLE ? `${texto.slice(0, LARGO_MAXIMO_DETALLE)}…` : texto);

export const registrarEvento = (tipo: TipoEvento, datos: DatosEvento): void => {
  buffer.push({
    id: siguienteId++,
    fecha: new Date().toISOString(),
    tipo,
    detalle: recortar(datos.detalle),
    ip: datos.ip,
    usuario: datos.usuario,
  });
  if (buffer.length > MAXIMO) buffer = buffer.slice(buffer.length - MAXIMO);
};

/** Eventos más nuevos primero. `desdeId` devuelve solo los posteriores a ese id (para consultar cambios). */
export const listarEventos = ({ desdeId = 0, tipo, limite = 200 }: { desdeId?: number; tipo?: TipoEvento; limite?: number } = {}) =>
  buffer
    .filter((e) => e.id > desdeId && (!tipo || e.tipo === tipo))
    .slice(-limite)
    .reverse();

export const limpiarEventos = (): void => {
  buffer = [];
};
