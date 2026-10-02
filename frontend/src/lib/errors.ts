import { isAxiosError } from 'axios';

/**
 * Convierte cualquier error de una llamada a la API en un mensaje legible.
 * Contempla los tres casos reales de tu backend:
 *  - sin respuesta (servidor caído o sin red)
 *  - 400 de validación: { message, errores: [{ campo, mensaje }] }
 *  - errores comunes: { message }
 */
export function getErrorMessage(err: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (!isAxiosError(err)) return fallback;

  // en getErrorMessage, antes del `if (!err.response)`:
if (err.code === 'ECONNABORTED') return 'El servidor tardó demasiado en responder';
  if (!err.response) return 'No se pudo conectar con el servidor';

  const { status, data } = err.response;
  const body =
    typeof data === 'object' && data !== null
      ? (data as { message?: string; errores?: { mensaje: string }[] })
      : undefined;

  // Detrás de un proxy (Vite en desarrollo, nginx en producción), un backend caído llega
  // como un 5xx SIN el JSON de nuestra API. Se distingue de un error real del backend
  // porque este siempre responde { message }.
  if (status >= 500 && !body?.message) return 'No se pudo conectar con el servidor';

  if (body?.errores?.length) return body.errores.map((e) => e.mensaje).join('. ');
  return body?.message ?? fallback;
}