import type { Remito } from '../../types/remito';
import { nombreArchivo } from './comun';
import { cargarPdfjs } from './pdfjs';

/**
 * Los archivos de un remito: el PDF A5 (para descargar), las imágenes PNG de ese mismo PDF
 * (para compartir, una por hoja) y el ticket de 80 mm para imprimir.
 * `imagenes` queda vacío si no se pudo convertir; en ese caso se comparte el PDF.
 */
export interface ArchivosRemito {
  digital: File;
  imagenes: File[];
  ticket: File;
}

/** Calidad de las imágenes: 2,5 px por punto del PDF deja el texto nítido en un celular sin pesar de más. */
const ESCALA_IMAGEN = 2.5;

/**
 * Convierte cada hoja de un PDF en una imagen PNG con exactamente el mismo diseño.
 * Si el PDF tiene varias hojas, los archivos se nombran "… (1 de 2).png", "… (2 de 2).png" para que lleguen ordenados.
 */
export async function pdfAImagenes(pdf: File, escala = ESCALA_IMAGEN): Promise<File[]> {
  const pdfjs = await cargarPdfjs();
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) });
  const documento = await tarea.promise;
  const base = pdf.name.replace(/\.pdf$/i, '');
  const imagenes: File[] = [];
  try {
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const vista = pagina.getViewport({ scale: escala });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vista.width);
      canvas.height = Math.ceil(vista.height);
      // Fondo blanco: sin esto las zonas vacías salen transparentes (negras en algunos visores).
      await pagina.render({ canvas, viewport: vista, background: '#ffffff' }).promise;
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
      if (!blob) throw new Error('No se pudo generar la imagen');
      const sufijo = documento.numPages > 1 ? ` (${n} de ${documento.numPages})` : '';
      imagenes.push(new File([blob], `${base}${sufijo}.png`, { type: 'image/png' }));
    }
  } finally {
    void tarea.destroy(); // libera la memoria del documento y del worker
  }
  return imagenes;
}

/**
 * Genera los archivos del remito. Las librerías de PDF se cargan recién acá (import dinámico),
 * así no pesan en la carga inicial de la app. Si falla la conversión a imagen no se rompe nada:
 * `imagenes` queda vacío y la app sigue compartiendo el PDF.
 */
export async function crearArchivos(remito: Remito): Promise<ArchivosRemito> {
  const [{ generarRemitoDigitalPdf }, { generarTicketPdf }] = await Promise.all([import('./digital'), import('./ticket')]);
  const aArchivo = (doc: { output: (t: 'arraybuffer') => ArrayBuffer }, nombre: string) =>
    new File([doc.output('arraybuffer')], nombre, { type: 'application/pdf' });
  const digital = aArchivo(generarRemitoDigitalPdf(remito), nombreArchivo(remito));
  const imagenes = await pdfAImagenes(digital).catch(() => [] as File[]);
  return { digital, imagenes, ticket: aArchivo(generarTicketPdf(remito), nombreArchivo(remito, 'Ticket')) };
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
export const puedeCompartir = (archivos: File[]) =>
  typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: archivos });

/**
 * Abre el menú de compartir del dispositivo con las imágenes del remito (o, si no se pudieron
 * generar, con el PDF). Devuelve false si el usuario lo cerró sin elegir nada; si el navegador no
 * soporta compartir archivos (por ejemplo, por no estar en HTTPS), los descarga para adjuntarlos a mano.
 *
 * IMPORTANTE: debe llamarse directo desde el toque del botón y con los archivos ya generados;
 * iOS rechaza compartir si pasa mucho tiempo entre el toque y la llamada.
 */
export async function compartir(archivos: ArchivosRemito): Promise<boolean> {
  const aCompartir = archivos.imagenes.length > 0 ? archivos.imagenes : [archivos.digital];
  if (!puedeCompartir(aCompartir)) {
    aCompartir.forEach(descargar);
    return true;
  }
  try {
    // Sin `title`: WhatsApp lo pondría como texto debajo de la imagen
    await navigator.share({ files: aCompartir });
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
