/**
 * Cliente de la cola de impresión del servidor (Render). Solo hace dos cosas:
 * pedir el siguiente trabajo e informar cómo terminó. Nunca se escribe la clave en los mensajes.
 */
import type { Config } from './config';

export interface Trabajo {
  id: string;
  ancho: number;
  alto: number;
  datos: Buffer;
}

export interface ClienteApi {
  siguiente(): Promise<Trabajo | null>;
  informar(id: string, ok: boolean, error?: string): Promise<void>;
}

/** Error de autenticación: la clave es incorrecta (hay que corregir la configuración, no reintentar en vano). */
export class ErrorClave extends Error {}

const ESPERA_MAXIMA_MS = 15_000;

export const crearClienteApi = (config: Pick<Config, 'servidorUrl' | 'token'>, http: typeof fetch = fetch): ClienteApi => {
  const llamar = async (ruta: string, cuerpo?: object): Promise<Response> => {
    const respuesta = await http(`${config.servidorUrl}/api/impresion/agente${ruta}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo ?? {}),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    if (respuesta.status === 401 || respuesta.status === 404) {
      throw new ErrorClave(
        respuesta.status === 401
          ? 'El servidor rechazó la clave del agente (AGENTE_TOKEN). Revisá que coincida con IMPRESION_AGENTE_TOKEN en Render.'
          : 'El servidor no tiene activada la impresión (falta IMPRESION_AGENTE_TOKEN en Render) o la dirección es incorrecta.'
      );
    }
    if (!respuesta.ok && respuesta.status !== 204) throw new Error(`El servidor respondió ${respuesta.status}`);
    return respuesta;
  };

  return {
    async siguiente() {
      const r = await llamar('/siguiente');
      if (r.status === 204) return null;
      const t = (await r.json()) as { id: string; ancho: number; alto: number; datos: string };
      return { id: t.id, ancho: t.ancho, alto: t.alto, datos: Buffer.from(t.datos, 'base64') };
    },
    async informar(id, ok, error) {
      await llamar(`/trabajos/${encodeURIComponent(id)}/resultado`, ok ? { ok: true } : { ok: false, error });
    },
  };
};
