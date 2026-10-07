import { Request, Response } from 'express';
import Remito from '../models/Remito';
import { estadoPago, redondear, totalEntregado } from '../services/cobranzas';

// ---------------------------------------------------------------------------
// Listado paginado con filtros
// ---------------------------------------------------------------------------

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 50;

/**
 * Convierte el texto buscado en una expresión regular que ignora mayúsculas y tildes
 * ("nino" encuentra "Niño", "jose" encuentra "José"). Primero se escapan los caracteres
 * especiales, así lo que escribe el usuario nunca se interpreta como una regex (evita ReDoS).
 */
export const regexInsensible = (texto: string): RegExp => {
  const sinTildes = texto.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const escapado = sinTildes.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const clases: Record<string, string> = {
    a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]'
  };
  const patron = escapado.replace(/[aeioun]/gi, (c) => clases[c.toLowerCase()]);
  return new RegExp(patron, 'i');
};

/**
 * Arma el filtro de MongoDB a partir de los parámetros de la URL (ya validados).
 * `q` busca por número de remito ("12" o "#12") y por nombre de cliente.
 */
export const armarFiltroRemitos = (query: Record<string, unknown>) => {
  const { estado, vendedor, fecha_desde, fecha_hasta, q } = query;
  const filtro: any = {};

  if (estado) filtro.estado = estado;
  if (vendedor) filtro.vendedor = vendedor;
  if (fecha_desde || fecha_hasta) {
    filtro.fecha = {};
    if (fecha_desde) filtro.fecha.$gte = new Date(fecha_desde as string);
    if (fecha_hasta) filtro.fecha.$lte = new Date(fecha_hasta as string);
  }

  const texto = typeof q === 'string' ? q.trim() : '';
  if (texto) {
    const condiciones: any[] = [{ nombre_cliente: regexInsensible(texto) }];
    const numero = texto.replace('#', '').trim();
    if (/^\d{1,9}$/.test(numero)) condiciones.push({ numero_remito: Number(numero) });
    filtro.$or = condiciones;
  }

  return filtro;
};

// Listar remitos: paginado, con filtros y sin el detalle de ítems (solo la cantidad) ni de entregas (solo lo entregado).
// Respuesta: { remitos, total, pagina, limite, totalPaginas }. El detalle completo se pide por ID.
export const getRemitos = async (req: Request, res: Response): Promise<void> => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina as string, 10) || 1);
    const limite = Math.min(LIMITE_MAXIMO, Math.max(1, parseInt(req.query.limite as string, 10) || LIMITE_POR_DEFECTO));
    const filtro = armarFiltroRemitos(req.query);

    // La lista y el total se piden en paralelo. Se trae solo el id de cada ítem (no su detalle)
    // para poder contarlos sin transferir cientos de bytes por línea.
    const [filas, total] = await Promise.all([
      Remito.find(filtro)
        .select('numero_remito fecha nombre_cliente total estado vendedor createdAt items.producto entregas.monto entregas.anulada')
        .populate('vendedor', 'nombre email')
        .sort({ numero_remito: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .lean(),
      Remito.countDocuments(filtro)
    ]);

    // Se agregan lo entregado, el saldo y el estado de cobro (calculados; el detalle de entregas no viaja)
    const remitos = filas.map(({ items, entregas, ...resto }: any) => {
      const entregado = totalEntregado(entregas);
      return {
        ...resto,
        cantidad_items: items.length,
        entregado,
        saldo: redondear(resto.total - entregado),
        estado_pago: estadoPago(resto.total, entregado)
      };
    });

    res.json({ remitos, total, pagina, limite, totalPaginas: Math.max(1, Math.ceil(total / limite)) });
  } catch (error) {
    console.error('Error en getRemitos:', error);
    res.status(500).json({ message: 'Error al obtener remitos' });
  }
};
