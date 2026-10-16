/**
 * Envío de bytes a la impresora por la red (puerto 9100, "impresión directa" o RAW).
 * Es una conexión TCP común: se abre, se manda todo y se cierra.
 */
import net from 'net';

/** Mensaje para mostrar al usuario: sin IPs ni detalles internos de la red del puesto. */
export class ErrorImpresora extends Error {}

export type EnviarAImpresora = (datos: Buffer) => Promise<void>;

export const crearEnvio =
  (host: string, puerto: number, timeoutMs: number): EnviarAImpresora =>
  (datos) =>
    new Promise<void>((resolver, rechazar) => {
      let terminado = false;
      const terminar = (error?: Error) => {
        if (terminado) return;
        terminado = true;
        socket.destroy();
        error ? rechazar(error) : resolver();
      };

      const socket = net.createConnection({ host, port: puerto });
      socket.setTimeout(timeoutMs);
      socket.once('timeout', () => terminar(new ErrorImpresora('La impresora no responde')));
      socket.once('error', (e: NodeJS.ErrnoException) => {
        const sinConexion = ['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'];
        terminar(new ErrorImpresora(sinConexion.includes(e.code ?? '') ? 'La impresora no responde' : 'Error al enviar a la impresora'));
      });
      // Se cierra del lado nuestro cuando terminó de escribir todo: entonces el trabajo salió
      socket.once('connect', () => socket.end(datos, () => terminar()));
    });
