import { formatMoneda } from '../format';
import type { Remito } from '../../types/remito';

/** Nombre del negocio que se imprime arriba en todos los comprobantes. Cambiarlo acá lo cambia en todos. */
export const NOMBRE_NEGOCIO = 'DOÑA LOLI';

/** Leyendas que deben figurar en todo comprobante. */
export const LEYENDA_1 = 'REMITO DE USO INTERNO';
export const LEYENDA_2 = 'DOCUMENTO NO VÁLIDO COMO FACTURA';

/** Intl devuelve espacios "duros" que la tipografía base del PDF no dibuja bien: los pasamos a espacio común. */
export const limpiar = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');
export const dinero = (n: number) => limpiar(formatMoneda(n));

/** "30/09/2026" */
export const fechaDia = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

/** "09:15" (24 hs) */
export const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

/** Número con ceros a la izquierda: 7 -> "0007". */
export const numeroRemito = (r: Remito) => String(r.numero_remito).padStart(4, '0');

/**
 * Nombre del archivo con el formato "Cliente - fecha - número", ej.: "Lorena Cuccol - 01-10-2026 - 0008.pdf".
 * Se quitan solo los caracteres que los sistemas de archivos no aceptan; las tildes y la ñ se conservan.
 * `prefijo` es opcional (el ticket de impresión usa "Ticket").
 */
export function nombreArchivo(r: Remito, prefijo?: string): string {
  const cliente = r.nombre_cliente
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
    .trim();
  const fecha = fechaDia(r.fecha).replace(/\//g, '-');
  return [prefijo, cliente, fecha, numeroRemito(r)].filter(Boolean).join(' - ') + '.pdf';
}
