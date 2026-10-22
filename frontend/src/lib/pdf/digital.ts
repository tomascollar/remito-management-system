import { jsPDF } from 'jspdf';
import { formatCantidad } from '../format';
import { etiquetaUnidad, nombreVendedor } from '../remitos';
import type { Remito } from '../../types/remito';
import { LEYENDA_1, LEYENDA_2, NOMBRE_NEGOCIO, dinero, fechaDia, fechaHora, numeroRemito } from './comun';

/*
 * PDF del remito para COMPARTIR (WhatsApp, mail) o guardar: hoja A5 vertical con renglones,
 * parecida a la nota de pedido de talonario del negocio. Las columnas son Cant. / Detalle /
 * Precio / Importe y solo se listan los productos vendidos.
 *
 * Para imprimir en la térmica se usa el otro formato (ticket.ts): acá el ancho permite
 * columnas, y en el celular se lee mucho mejor que un ticket angosto.
 *
 * Es una función pura (no toca el DOM). Medidas en milímetros.
 */

// --- Medidas de la hoja (A5 vertical) ---
const ANCHO = 148;
const ALTO = 210;
const MARGEN = 9;
const ANCHO_UTIL = ANCHO - MARGEN * 2; // 130
const X_CENTRO = ANCHO / 2;

// Columnas de la tabla (suman ANCHO_UTIL)
const COL = { cant: 26, detalle: 50, precio: 25, importe: 29 } as const;
const X_CANT = MARGEN;
const X_DETALLE = X_CANT + COL.cant;
const X_PRECIO = X_DETALLE + COL.detalle;
const X_IMPORTE = X_PRECIO + COL.precio;
const X_FIN = MARGEN + ANCHO_UTIL;

const Y_TABLA = 59; // donde empieza el encabezado de la tabla
const ALTO_ENCABEZADO = 7;
const ALTO_FILA = 7.5;
const ALTO_PIE_BASE = 17;
const ALTO_PIE_CON_ENTREGAS = 29; // más alto para sumar "Entregado" y el saldo

/** ¿Hay entregas vigentes? Entonces el pie muestra lo entregado y el saldo. */
const hayEntregas = (r: Remito) => r.entregas.some((e) => !e.anulada);
const altoPie = (r: Remito) => (hayEntregas(r) ? ALTO_PIE_CON_ENTREGAS : ALTO_PIE_BASE);
const yPie = (r: Remito) => ALTO - MARGEN - altoPie(r);
/** Cuántos renglones entran por hoja entre el encabezado de la tabla y el pie. */
const filasPorHoja = (r: Remito) => Math.floor((yPie(r) - 2 - (Y_TABLA + ALTO_ENCABEZADO)) / ALTO_FILA);

/** Un renglón de la tabla: los productos y también los ajustes (que no tienen cantidad ni precio). */
interface Fila {
  cant: string;
  detalle: string;
  precio: string;
  importe: string;
  resaltada?: boolean; // se pinta de amarillo, como con un resaltador
}

/** Productos primero y ajustes después, en el mismo orden en que se ven en pantalla. */
const filasDe = (r: Remito): Fila[] => [
  ...r.items.map((it) => ({
    cant: `${formatCantidad(it.cantidad)} ${etiquetaUnidad(it.cantidad, it.unidad_venta)}`,
    detalle: it.nombre_producto,
    precio: dinero(it.precio_unitario),
    importe: dinero(it.subtotal),
  })),
  ...r.ajustes.map((a) => ({
    cant: '',
    detalle: a.concepto,
    precio: '',
    importe: dinero(a.monto),
    resaltada: a.resaltado === true,
  })),
];

/** Recorta el texto con "…" para que nunca se pase de la columna. */
function ajustar(doc: jsPDF, texto: string, ancho: number) {
  if (doc.getTextWidth(texto) <= ancho) return texto;
  let t = texto;
  while (t.length > 1 && doc.getTextWidth(t + '…') > ancho) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

/** Lo que se repite en cada hoja: negocio, leyendas, número, fecha, vendedor, cliente y encabezado de la tabla. */
function dibujarCabecera(doc: jsPDF, r: Remito, negocio: string, hoja: number, totalHojas: number) {
  // Nombre del negocio
  doc.setTextColor(20).setFont('helvetica', 'bold').setFontSize(26);
  doc.text(negocio, X_CENTRO, 18, { align: 'center' });

  // Leyendas obligatorias, enmarcadas
  doc.setDrawColor(40).setLineWidth(0.5).rect(MARGEN, 22, ANCHO_UTIL, 12);
  doc.setFontSize(12).text(LEYENDA_1, X_CENTRO, 28, { align: 'center' });
  doc.setFontSize(9).text(LEYENDA_2, X_CENTRO, 32.3, { align: 'center' });

  // Número (izquierda) y fecha (derecha, destacada)
  doc.setFontSize(14).text(`REMITO N° ${numeroRemito(r)}`, MARGEN, 43);
  doc.text(fechaDia(r.fecha), X_FIN, 43, { align: 'right' });

  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90);
  const vendedor = nombreVendedor(r);
  doc.text(`${vendedor ? `Vendedor: ${vendedor}` : ''}`, MARGEN, 48.5);
  doc.text(totalHojas > 1 ? `${fechaHora(r.fecha)} hs  ·  Hoja ${hoja} de ${totalHojas}` : `${fechaHora(r.fecha)} hs`, X_FIN, 48.5, {
    align: 'right',
  });

  // "Cliente: ........" con el nombre sobre la línea
  doc.setTextColor(20).setFont('helvetica', 'bold').setFontSize(11);
  doc.text('Cliente:', MARGEN, 55.5);
  const xNombre = MARGEN + doc.getTextWidth('Cliente: ');
  doc.setLineDashPattern([0.6, 0.8], 0).setLineWidth(0.25).line(xNombre, 56.3, X_FIN, 56.3);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal').setFontSize(11);
  doc.text(ajustar(doc, r.nombre_cliente, X_FIN - xNombre - 2), xNombre + 1, 55.1);

  // Encabezado de la tabla
  doc.setFillColor(235, 235, 235).rect(MARGEN, Y_TABLA, ANCHO_UTIL, ALTO_ENCABEZADO, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(40);
  const yTxt = Y_TABLA + 4.8;
  doc.text('CANT.', X_CANT + 2, yTxt);
  doc.text('DETALLE', X_DETALLE + 2, yTxt);
  doc.text('PRECIO', X_IMPORTE - 2, yTxt, { align: 'right' });
  doc.text('IMPORTE', X_FIN - 2, yTxt, { align: 'right' });
}

/** Renglones de la tabla (con datos o vacíos, como el talonario) y sus líneas verticales. */
function dibujarFilas(doc: jsPDF, filas: Fila[], porHoja: number) {
  const y0 = Y_TABLA + ALTO_ENCABEZADO;
  doc.setDrawColor(60).setLineWidth(0.25);

  for (let i = 0; i < porHoja; i++) {
    const yFila = y0 + i * ALTO_FILA;
    if (filas[i]?.resaltada) {
      doc.setFillColor(255, 238, 90).rect(MARGEN, yFila, ANCHO_UTIL, ALTO_FILA, 'F'); // antes de las líneas, para que no las tape
    }
    doc.line(MARGEN, yFila + ALTO_FILA, X_FIN, yFila + ALTO_FILA); // línea inferior del renglón
    const fila = filas[i];
    if (!fila) continue;

    const yTxt = yFila + 5;
    doc.setTextColor(20).setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(fila.cant, X_CANT + 2, yTxt);
    doc.setFont('helvetica', 'normal');
    doc.text(ajustar(doc, fila.detalle, COL.detalle - 4), X_DETALLE + 2, yTxt);
    doc.text(fila.precio, X_IMPORTE - 2, yTxt, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(fila.importe, X_FIN - 2, yTxt, { align: 'right' });
  }

  // Marco exterior y divisiones de columnas
  const yFin = y0 + porHoja * ALTO_FILA;
  doc.setLineWidth(0.4).rect(MARGEN, Y_TABLA, ANCHO_UTIL, yFin - Y_TABLA);
  doc.setLineWidth(0.25);
  for (const x of [X_DETALLE, X_PRECIO, X_IMPORTE]) doc.line(x, Y_TABLA, x, yFin);
}

/**
 * Pie: cantidad de productos y total (el total solo se muestra en la última hoja).
 * Si hay entregas vigentes, debajo del total van lo entregado y el saldo.
 */
function dibujarPie(doc: jsPDF, r: Remito, ultima: boolean) {
  const Y_PIE = yPie(r);
  doc.setDrawColor(60).setLineWidth(0.4).rect(MARGEN, Y_PIE, ANCHO_UTIL, altoPie(r));
  const n = r.items.length;
  doc.setTextColor(20).setFont('helvetica', 'normal').setFontSize(9);
  doc.text(`${n} ${n === 1 ? 'producto' : 'productos'}`, MARGEN + 4, Y_PIE + 6);
  doc.setFontSize(hayEntregas(r) ? 8 : 9);
  doc.text(`ALIAS: LOLI.MERCADO.DANI`, MARGEN + 4, Y_PIE + (hayEntregas(r) ? 24 : 13)); // más abajo si el pie lleva entregas

  if (ultima) {
    if (hayEntregas(r)) {
      // Con entregas el protagonista es lo que falta pagar: total y entregado chicos, saldo grande
      doc.setFont('helvetica', 'normal').setFontSize(9).text('TOTAL $', X_PRECIO - 4, Y_PIE + 7, { align: 'right' });
      doc.setFontSize(10).text(dinero(r.total), X_FIN - 3, Y_PIE + 7, { align: 'right' });
      doc.setFontSize(9).text('ENTREGADO $', X_PRECIO - 4, Y_PIE + 12.5, { align: 'right' });
      doc.setFontSize(10).text(dinero(r.entregado), X_FIN - 3, Y_PIE + 12.5, { align: 'right' });
      doc.setDrawColor(60).setLineWidth(0.25).line(X_PRECIO - 30, Y_PIE + 15.2, X_FIN - 3, Y_PIE + 15.2);
      doc.setFont('helvetica', 'bold').setFontSize(10).text(r.saldo < 0 ? 'A SU FAVOR $' : 'A PAGAR $', X_PRECIO - 4, Y_PIE + 24, { align: 'right' });
      doc.setFontSize(20).text(dinero(Math.abs(r.saldo)), X_FIN - 3, Y_PIE + 24.6, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'bold').setFontSize(9).text('TOTAL $', X_PRECIO - 4, Y_PIE + 10.5, { align: 'right' });
      doc.setFontSize(15).text(dinero(r.total), X_FIN - 3, Y_PIE + 10.9, { align: 'right' });
    }
  } else {
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90);
    doc.text('Continúa en la hoja siguiente', X_FIN - 3, Y_PIE + 10, { align: 'right' });
  }
}

/**
 * Arma el PDF A5 de un remito. Si tiene más renglones que los que entran en una hoja,
 * continúa en hojas siguientes repitiendo la cabecera; el total va en la última.
 */
export function generarRemitoDigitalPdf(remito: Remito, opciones: { negocio?: string } = {}): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const negocio = opciones.negocio ?? NOMBRE_NEGOCIO;
  const filas = filasDe(remito);
  const porHoja = filasPorHoja(remito);
  const totalHojas = Math.max(1, Math.ceil(filas.length / porHoja));

  for (let h = 0; h < totalHojas; h++) {
    if (h > 0) doc.addPage('a5', 'portrait');
    dibujarCabecera(doc, remito, negocio, h + 1, totalHojas);
    dibujarFilas(doc, filas.slice(h * porHoja, (h + 1) * porHoja), porHoja);
    dibujarPie(doc, remito, h === totalHojas - 1);
  }
  return doc;
}
