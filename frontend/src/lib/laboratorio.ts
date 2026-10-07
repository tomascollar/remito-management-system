import type { TipoEvento } from '../types/laboratorio';

/** 900 -> "15 minutos", 90 -> "1 min 30 s", 28800 -> "8 horas". */
export const describirDuracion = (seg: number): string => {
  if (seg < 60) return `${seg} ${seg === 1 ? 'segundo' : 'segundos'}`;
  if (seg < 3600) {
    const min = Math.floor(seg / 60);
    const resto = seg % 60;
    return resto ? `${min} min ${resto} s` : `${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  }
  const horas = Math.floor(seg / 3600);
  const min = Math.floor((seg % 3600) / 60);
  return min ? `${horas} h ${min} min` : `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
};

/** Milisegundos restantes -> "01:05" (nunca negativo). */
export const formatRestante = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const hora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
/** Hora con segundos ("14:03:07"), para ver el orden de los eventos. */
export const formatHora = (ms: number | string) => hora.format(new Date(ms));

/** Lee el contenido (payload) de un JWT sin verificarlo: sirve solo para mostrarlo. */
export const decodificarPayload = (token: string): Record<string, unknown> | null => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** Etiqueta y colores de cada tipo de evento del registro. */
export const TIPOS_EVENTO: Record<TipoEvento, { etiqueta: string; chip: string }> = {
  login_ok: { etiqueta: 'Login correcto', chip: 'bg-success-50 text-success-700' },
  login_fallido: { etiqueta: 'Login fallido', chip: 'bg-warning-50 text-warning-700' },
  login_bloqueado: { etiqueta: 'Login bloqueado', chip: 'bg-danger-50 text-danger-700' },
  peticiones_bloqueadas: { etiqueta: 'Peticiones bloqueadas', chip: 'bg-danger-50 text-danger-700' },
  token_expirado: { etiqueta: 'Token expirado', chip: 'bg-warning-50 text-warning-700' },
  token_invalido: { etiqueta: 'Token inválido', chip: 'bg-danger-50 text-danger-700' },
  acceso_denegado: { etiqueta: 'Acceso denegado', chip: 'bg-danger-50 text-danger-700' },
  config_cambiada: { etiqueta: 'Configuración', chip: 'bg-primary-50 text-primary-700' },
  contadores_reiniciados: { etiqueta: 'Contadores en cero', chip: 'bg-primary-50 text-primary-700' },
};

/** Convierte lo escrito en un campo a número entero; null si está vacío o no es un entero válido. */
export const aEntero = (texto: string): number | null => {
  if (texto.trim() === '') return null;
  const n = Number(texto);
  return Number.isInteger(n) ? n : null;
};

/** Hora actual del dispositivo en ms. Se aísla en una función para usarla desde manejadores de eventos y temporizadores. */
export const ahoraMs = () => Date.now();
