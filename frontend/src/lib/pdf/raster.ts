/**
 * Convierte el ticket (PDF de 80 mm) en la imagen que entiende la impresora térmica:
 * blanco y negro, 1 bit por punto, 576 puntos de ancho (72 mm a 8 puntos por mm).
 *
 * El diseño del ticket NO se rehace: se toma el mismo PDF que ya se genera, se dibuja como imagen
 * con pdf.js y se pasa a blanco y negro. Así lo que se imprime es idéntico al ticket de la app.
 */
import { cargarPdfjs } from './pdfjs';

/** El rollo es de 80 mm = 640 puntos; la impresora imprime los 576 centrales (72 mm). */
export const ANCHO_PAPEL = 640;
export const ANCHO_IMPRESION = 576;
/** Alto máximo que acepta el servidor (≈ 75 cm de papel). */
export const ALTO_MAXIMO = 6000;
/** Un punto es negro si su brillo (0 negro a 255 blanco) es menor a este valor. */
const UMBRAL = 160;

export interface RasterTicket {
  ancho: number;
  alto: number;
  /** 1 bit por punto, fila por fila, bit más significativo primero (1 = negro), en base64. */
  datos: string;
}

/** El ticket no entra en el máximo que acepta el servidor. */
export class TicketMuyLargo extends Error {}

/**
 * De píxeles RGBA (lo que da un canvas) a 1 bit por punto. Toma `anchoSalida` columnas a partir de
 * `desdeX` (el recorte central) y empaqueta 8 puntos por byte. La transparencia cuenta como blanco.
 */
export function rgbaA1Bit(rgba: Uint8ClampedArray, anchoOrigen: number, alto: number, desdeX: number, anchoSalida: number, umbral = UMBRAL): Uint8Array {
  const bytesPorFila = anchoSalida / 8;
  const salida = new Uint8Array(bytesPorFila * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < anchoSalida; x++) {
      const i = (y * anchoOrigen + desdeX + x) * 4;
      const alfa = rgba[i + 3] / 255;
      // Se mezcla con fondo blanco: un punto transparente no puede salir negro
      const brillo = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * alfa + 255 * (1 - alfa);
      if (brillo < umbral) salida[y * bytesPorFila + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return salida;
}

/** Base64 de un conjunto de bytes, por tramos (una sola llamada con una imagen grande desborda la pila). */
export function aBase64(bytes: Uint8Array): string {
  let texto = '';
  const tramo = 0x8000;
  for (let i = 0; i < bytes.length; i += tramo) texto += String.fromCharCode(...bytes.subarray(i, i + tramo));
  return btoa(texto);
}

/** Convierte el PDF del ticket en la imagen lista para enviar a imprimir. */
export async function ticketARaster(pdf: File): Promise<RasterTicket> {
  const pdfjs = await cargarPdfjs();
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) });
  try {
    const documento = await tarea.promise;
    const pagina = await documento.getPage(1); // el ticket es una sola hoja continua
    // Escala para que el ancho de la hoja (80 mm) sea exactamente 640 puntos
    const escala = ANCHO_PAPEL / pagina.getViewport({ scale: 1 }).width;
    const vista = pagina.getViewport({ scale: escala });

    const canvas = document.createElement('canvas');
    canvas.width = ANCHO_PAPEL;
    canvas.height = Math.ceil(vista.height);
    if (canvas.height > ALTO_MAXIMO) throw new TicketMuyLargo('El ticket es demasiado largo para imprimirlo');

    await pagina.render({ canvas, viewport: vista, background: '#ffffff' }).promise;
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('No se pudo preparar la imagen del ticket');
    const { data } = contexto.getImageData(0, 0, canvas.width, canvas.height);

    const recorte = (ANCHO_PAPEL - ANCHO_IMPRESION) / 2; // 32 puntos (4 mm) de cada lado
    const bits = rgbaA1Bit(data, canvas.width, canvas.height, recorte, ANCHO_IMPRESION);
    return { ancho: ANCHO_IMPRESION, alto: canvas.height, datos: aBase64(bits) };
  } finally {
    void tarea.destroy();
  }
}
