import type { Remito } from '../../types/remito';
import { nombreArchivo, numeroRemito } from './comun';

/** Los dos archivos de un remito: el A5 para compartir y el ticket de 80 mm para imprimir. */
export interface ArchivosRemito {
  digital: File;
  ticket: File;
}

/**
 * Genera los PDFs del remito. Las librerías de PDF se cargan recién acá (import dinámico),
 * así no pesan en la carga inicial de la app.
 */
export async function crearArchivos(remito: Remito): Promise<ArchivosRemito> {
  const [{ generarRemitoDigitalPdf }, { generarTicketPdf }] = await Promise.all([import('./digital'), import('./ticket')]);
  const aArchivo = (doc: { output: (t: 'arraybuffer') => ArrayBuffer }, nombre: string) =>
    new File([doc.output('arraybuffer')], nombre, { type: 'application/pdf' });
  return {
    digital: aArchivo(generarRemitoDigitalPdf(remito), nombreArchivo(remito)),
    ticket: aArchivo(generarTicketPdf(remito), nombreArchivo(remito, 'Ticket')),
  };
}

/** Descarga el archivo (en el celular lo guarda en Descargas / Archivos). */
export function descargar(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** ¿Este navegador puede compartir archivos con el menú nativo del sistema (WhatsApp, mail…)? */
export const puedeCompartir = (archivo: File) =>
  typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivo] });

/**
 * Abre el menú de compartir del dispositivo con el PDF adjunto.
 * Devuelve false si el usuario lo cerró sin elegir nada; si el navegador no soporta compartir
 * archivos (por ejemplo, por no estar en HTTPS), descarga el PDF para adjuntarlo a mano.
 *
 * IMPORTANTE: debe llamarse directo desde el toque del botón y con el archivo ya generado;
 * iOS rechaza compartir si pasa mucho tiempo entre el toque y la llamada.
 */
export async function compartir(archivo: File, remito: Remito): Promise<boolean> {
  if (!puedeCompartir(archivo)) {
    descargar(archivo);
    return true;
  }
  try {
    await navigator.share({ files: [archivo], title: `Remito N° ${numeroRemito(remito)}` });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false; // lo cerró el usuario
    throw err;
  }
}

/**
 * Abre el ticket en una pestaña nueva con el visor de PDF del navegador, desde donde se
 * imprime (Ctrl+P) eligiendo la térmica. Devuelve false si el navegador bloqueó la pestaña.
 */
export function abrirParaImprimir(archivo: File): boolean {
  const url = URL.createObjectURL(archivo);
  const ventana = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  return ventana !== null;
}
