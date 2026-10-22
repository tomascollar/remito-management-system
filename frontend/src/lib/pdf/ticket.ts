import { jsPDF } from 'jspdf';
import { formatCantidad } from '../format';
import { etiquetaUnidad, nombreVendedor } from '../remitos';
import type { Remito } from '../../types/remito';
import { LEYENDA_1, LEYENDA_2, NOMBRE_NEGOCIO, dinero, fechaDia, fechaHora, numeroRemito } from './comun';

/*
 * Generador del ticket del remito para impresora térmica de 80 mm.
 *
 * - El papel es continuo: el PDF tiene 80 mm de ancho y el alto justo del contenido
 *   (se mide primero y se dibuja después), así no sale papel en blanco.
 * - La zona imprimible de un rollo de 80 mm es de ~72 mm, por eso hay 4 mm de margen a cada lado.
 * - Las térmicas imprimen solo en negro: no hay grises ni marcas de agua. El énfasis se logra
 *   con tamaño, negrita y recuadros.
 * - Cada producto ocupa dos renglones (nombre / cantidad x precio = importe) en vez de columnas,
 *   para que los textos sean grandes y se lean bien en un ancho tan angosto.
 *
 * Es una función pura (no toca el DOM), así que se puede probar sin navegador.
 * Todas las medidas están en milímetros y los tamaños de letra en puntos.
 */

const ANCHO = 80;
const MARGEN = 4;
const W = ANCHO - MARGEN * 2; // ancho útil: 72 mm
const X_IZQ = MARGEN;
const X_DER = ANCHO - MARGEN;
const X_CENTRO = ANCHO / 2;
const PT = 0.3528; // 1 punto en mm

interface OpcionesTicket {
  negocio?: string;
}

/**
 * Dibuja todo el ticket sobre `doc` y devuelve la altura que ocupó.
 * Se llama dos veces: una sobre una hoja larguísima para medir, y otra sobre la hoja del
 * tamaño exacto para el PDF final.
 */
function dibujar(doc: jsPDF, r: Remito, negocio: string): number {
  let y = 5; // posición vertical actual (mm desde arriba)

  /** Escribe texto (con salto de línea automático) y avanza `y`. `x` y `align` definen la alineación. */
  const texto = (
    str: string,
    size: number,
    o: { bold?: boolean; align?: 'left' | 'center' | 'right'; gap?: number } = {},
  ) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal').setFontSize(size).setTextColor(0);
    const alto = size * PT * 1.25; // alto de cada renglón
    const x = o.align === 'center' ? X_CENTRO : o.align === 'right' ? X_DER : X_IZQ;
    for (const linea of doc.splitTextToSize(str, W) as string[]) {
      y += alto;
      doc.text(linea, x, y - alto * 0.22, { align: o.align ?? 'left' });
    }
    y += o.gap ?? 0;
  };

  const linea = (grosor: number, punteada = false) => {
    doc.setDrawColor(0).setLineWidth(grosor);
    doc.setLineDashPattern(punteada ? [0.7, 0.9] : [], 0);
    doc.line(X_IZQ, y, X_DER, y);
    doc.setLineDashPattern([], 0);
  };

  /** Concepto a la izquierda (puede ocupar varios renglones) e importe a la derecha, alineado al primero. */
  const renglonMonto = (concepto: string, importe: string, size: number, bold: boolean, resaltar = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(0);
    const alto = size * PT * 1.25;
    const lineas = doc.splitTextToSize(concepto, W - 26) as string[];
    if (resaltar) {
      // La térmica solo imprime en negro: "resaltar" = franja negra con letras blancas
      doc.setFillColor(0, 0, 0).rect(X_IZQ, y + 0.3, W, alto * lineas.length + 0.8, 'F');
      doc.setTextColor(255);
    }
    const pad = resaltar ? 1 : 0; // sangría para que el texto no pegue con el borde de la franja
    lineas.forEach((txt, i) => {
      y += alto;
      doc.text(txt, X_IZQ + pad, y - alto * 0.22);
      if (i === 0) doc.text(importe, X_DER - pad, y - alto * 0.22, { align: 'right' });
    });
    doc.setTextColor(0);
  };

  // Nombre del negocio, grande
  texto(negocio, 24, { bold: true, align: 'center', gap: 2 });

  // Leyenda obligatoria, enmarcada para que se destaque
  const yCaja = y;
  y += 1.5;
  texto(LEYENDA_1, 10.5, { bold: true, align: 'center' });
  texto(LEYENDA_2, 8, { bold: true, align: 'center' });
  y += 1.5;
  doc.setDrawColor(0).setLineWidth(0.5).rect(X_IZQ, yCaja, W, y - yCaja);
  y += 4;

  // Número y fecha: la fecha es lo que más se consulta, por eso va grande
  texto(`REMITO N° ${numeroRemito(r)}`, 12, { bold: true, align: 'center', gap: 1 });
  texto(fechaDia(r.fecha), 17, { bold: true, align: 'center' });
  texto(`${fechaHora(r.fecha)} hs`, 11, { align: 'center', gap: 2 });

  const vendedor = nombreVendedor(r);
  if (vendedor) texto(`Vendedor: ${vendedor}`, 10.5, { align: 'center', gap: 2 });

  y += 1;
  linea(0.5);
  y += 1;
  texto('CLIENTE', 8, { gap: 0 });
  texto(r.nombre_cliente, 13, { bold: true, gap: 2 });
  linea(0.5);
  y += 2.5;

  // Productos: nombre arriba; abajo "cantidad x precio" a la izquierda e importe a la derecha
  if (r.items.length === 0) texto('(sin productos)', 10, { align: 'center', gap: 3 });
  r.items.forEach((it, i) => {
    texto(it.nombre_producto, 11, { bold: true });
    const detalle = `${formatCantidad(it.cantidad)} ${etiquetaUnidad(it.cantidad, it.unidad_venta)}  x  ${dinero(it.precio_unitario)}`;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(0);
    const ancho = 10 * PT * 1.25;
    y += ancho;
    doc.text(detalle, X_IZQ, y - ancho * 0.22);
    doc.setFont('helvetica', 'bold').setFontSize(11.5);
    doc.text(dinero(it.subtotal), X_DER, y - ancho * 0.22, { align: 'right' });
    y += 2;
    if (i < r.items.length - 1) {
      linea(0.25, true); // separador punteado entre productos
      y += 1.5;
    }
  });

  // Ajustes (saldo anterior, descuentos): renglones sin cantidad ni precio, solo concepto e importe
  if (r.ajustes.length > 0) {
    if (r.items.length > 0) {
      linea(0.25, true);
      y += 1.5;
    }
    r.ajustes.forEach((a) => {
      renglonMonto(a.concepto, dinero(a.monto), 11, true, a.resaltado === true);
      y += 1.5;
    });
  }

    const conEntregas = r.entregas.some((e) => !e.anulada) || r.total < 0; // las anuladas no cuentan

  if (conEntregas) {
    // Con entregas, lo que le importa al cliente es lo que TODAVÍA debe: el total original y lo
    // entregado quedan chicos, y el saldo va grande y enmarcado.
    y += 1;
    linea(0.5);
    y += 1;
    renglonMonto('Total', dinero(r.total), 11, false);
    renglonMonto('Entregado', dinero(r.entregado), 11, false);
    y += 2;
    linea(0.8);
    y += 1;
    const alto = 22 * PT * 1.25;
    y += alto;
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(0);
    doc.text(r.saldo < 0 ? 'A FAVOR' : 'A PAGAR', X_IZQ, y - alto * 0.3);
    doc.setFontSize(22);
    doc.text(dinero(Math.abs(r.saldo)), X_DER, y - alto * 0.22, { align: 'right' });
    y += 2;
    linea(0.8);
    y += 3;
  } else {
    // Total
    y += 1;
    linea(0.8);
    y += 1;
    const altoTotal = 18 * PT * 1.25;
    y += altoTotal;
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(0);
    doc.text('TOTAL', X_IZQ, y - altoTotal * 0.3);
    doc.setFontSize(18);
    doc.text(dinero(r.total), X_DER, y - altoTotal * 0.22, { align: 'right' });
    y += 2;
    linea(0.8);
    y += 3;
  }

  const n = r.items.length;
  texto(`${n} ${n === 1 ? 'producto' : 'productos'}`, 8.5, { align: 'center' });

  // Espacio final para que el corte del papel no se coma el último renglón
  return y + 12;
}

/**
 * Arma el PDF del ticket de un remito: 80 mm de ancho y alto ajustado al contenido.
 * Se dibuja una vez sobre una hoja larga solo para medir, y otra vez con el tamaño exacto.
 */
export function generarTicketPdf(remito: Remito, opciones: OpcionesTicket = {}): jsPDF {
  const negocio = opciones.negocio ?? NOMBRE_NEGOCIO;
  const medidor = new jsPDF({ unit: 'mm', format: [ANCHO, 5000] });
  const alto = dibujar(medidor, remito, negocio);

  const doc = new jsPDF({ unit: 'mm', format: [ANCHO, alto], orientation: 'portrait' });
  dibujar(doc, remito, negocio);
  return doc;
}
