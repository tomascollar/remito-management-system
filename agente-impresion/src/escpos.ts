/**
 * ESC/POS: el "idioma" que entienden las impresoras térmicas Epson.
 *
 * Un ticket se manda como una IMAGEN en blanco y negro (el diseño del ticket se arma en la app y
 * llega ya convertido). Acá solo se la envuelve en los comandos de la impresora:
 *
 *   ESC @        inicializar (borra la configuración que haya dejado el trabajo anterior)
 *   GS v 0 …     imprimir imagen ("raster"), por franjas
 *   ESC d n      avanzar n líneas de papel (para que el último renglón pase el cortador)
 *   GS V m       cortar
 */
import type { Corte } from './config';

/** Franja de imagen por comando: evita desbordar el buffer de la impresora con tickets largos. */
export const FILAS_POR_FRANJA = 256;
/** Líneas de papel que se avanzan antes de cortar (si no, el corte pasaría por encima del último renglón). */
export const LINEAS_ANTES_DE_CORTAR = 5;

export const inicializar = (): Buffer => Buffer.from([0x1b, 0x40]);

/**
 * Imagen en franjas. `datos` es 1 bit por punto, fila por fila, bit más significativo primero
 * (1 = negro), y debe medir exactamente (ancho / 8) × alto bytes.
 * Cada franja es:  GS v 0 m xL xH yL yH  datos   (xL xH = bytes por fila; yL yH = filas; m = 0)
 */
export const imagenRaster = (ancho: number, alto: number, datos: Buffer): Buffer => {
  if (!Number.isInteger(ancho) || ancho <= 0 || ancho % 8 !== 0 || ancho > 2040) throw new Error('Ancho de imagen inválido');
  if (!Number.isInteger(alto) || alto <= 0) throw new Error('Alto de imagen inválido');
  const bytesPorFila = ancho / 8;
  if (datos.length !== bytesPorFila * alto) throw new Error('El tamaño de la imagen no coincide con el ancho y el alto');

  const partes: Buffer[] = [];
  for (let fila = 0; fila < alto; fila += FILAS_POR_FRANJA) {
    const filas = Math.min(FILAS_POR_FRANJA, alto - fila);
    partes.push(Buffer.from([0x1d, 0x76, 0x30, 0x00, bytesPorFila & 0xff, bytesPorFila >> 8, filas & 0xff, filas >> 8]));
    partes.push(datos.subarray(fila * bytesPorFila, (fila + filas) * bytesPorFila));
  }
  return Buffer.concat(partes);
};

/** Avanza el papel y corta (GS V 1 = corte parcial, GS V 0 = total). Con "ninguno" solo avanza. */
export const avanzarYCortar = (corte: Corte): Buffer => {
  const avance = Buffer.from([0x1b, 0x64, LINEAS_ANTES_DE_CORTAR]);
  if (corte === 'ninguno') return avance;
  return Buffer.concat([avance, Buffer.from([0x1d, 0x56, corte === 'total' ? 0x00 : 0x01])]);
};

/** El trabajo completo, listo para enviar a la impresora. */
export const armarTicket = (ancho: number, alto: number, datos: Buffer, corte: Corte): Buffer =>
  Buffer.concat([inicializar(), imagenRaster(ancho, alto, datos), avanzarYCortar(corte)]);

/**
 * Hoja de prueba (sin servidor): un renglón de texto y un marco que ocupa TODO el ancho de 80 mm.
 * Si el marco sale entero y centrado, el ancho (576 puntos) está bien; si se corta de un lado,
 * hay que revisar el papel o el ancho configurado.
 */
export const hojaDePrueba = (corte: Corte, ancho = 576, alto = 160): Buffer => {
  const bytesPorFila = ancho / 8;
  const datos = Buffer.alloc(bytesPorFila * alto, 0x00);
  const borde = 4; // grosor del marco en puntos
  for (let y = 0; y < alto; y++) {
    for (let b = 0; b < bytesPorFila; b++) {
      const bordeVertical = b === 0 || b === bytesPorFila - 1;
      const bordeHorizontal = y < borde || y >= alto - borde;
      if (bordeHorizontal) datos[y * bytesPorFila + b] = 0xff;
      else if (bordeVertical) datos[y * bytesPorFila + b] = b === 0 ? 0xf0 : 0x0f; // 4 puntos de cada lado
    }
  }
  const texto = Buffer.from('AGENTE DE IMPRESION - PRUEBA\nSi ves el marco completo, el ancho esta bien.\n', 'ascii');
  return Buffer.concat([inicializar(), texto, imagenRaster(ancho, alto, datos), avanzarYCortar(corte)]);
};
