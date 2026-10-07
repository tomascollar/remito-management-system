import { Request, Response } from 'express';
import MovimientoStock from '../models/MovimientoStock';

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 50;

/** Arma el filtro de MongoDB a partir de los parámetros de la URL (ya validados). */
export const armarFiltroMovimientos = (query: Record<string, unknown>) => {
  const { producto, usuario, tipo, fecha_desde, fecha_hasta } = query;
  const filtro: any = {};

  if (producto) filtro.producto = producto;
  if (usuario) filtro.usuario = usuario;
  if (tipo) filtro.tipo = tipo;
  if (fecha_desde || fecha_hasta) {
    filtro.fecha = {};
    if (fecha_desde) filtro.fecha.$gte = new Date(fecha_desde as string);
    if (fecha_hasta) filtro.fecha.$lte = new Date(fecha_hasta as string);
  }

  return filtro;
};

// Historial de movimientos de stock: paginado, con filtros, más nuevos primero.
// Respuesta: { movimientos, total, pagina, limite, totalPaginas }.
// Solo lectura: los movimientos no se editan ni se borran (es el registro de auditoría).
export const getMovimientos = async (req: Request, res: Response): Promise<void> => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina as string, 10) || 1);
    const limite = Math.min(LIMITE_MAXIMO, Math.max(1, parseInt(req.query.limite as string, 10) || LIMITE_POR_DEFECTO));
    const filtro = armarFiltroMovimientos(req.query);

    const [movimientos, total] = await Promise.all([
      MovimientoStock.find(filtro)
        .populate('producto', 'nombre categoria')
        .populate('usuario', 'nombre email')
        .populate('remito', 'numero_remito nombre_cliente')
        .sort({ fecha: -1, _id: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .lean(),
      MovimientoStock.countDocuments(filtro)
    ]);

    res.json({ movimientos, total, pagina, limite, totalPaginas: Math.max(1, Math.ceil(total / limite)) });
  } catch (error) {
    console.error('Error en getMovimientos:', error);
    res.status(500).json({ message: 'Error al obtener el historial de stock' });
  }
};
