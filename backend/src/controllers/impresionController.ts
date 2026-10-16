import { Request, Response } from 'express';
import TrabajoImpresion from '../models/TrabajoImpresion';
import { agenteConectado, fechaUltimoContacto, registrarContactoAgente } from '../services/estadoAgente';

/**
 * Cola de impresión del ticket. Dos "clientes" distintos usan este módulo:
 *   - las PERSONAS (celular, con su sesión): piden imprimir y consultan cómo salió;
 *   - el AGENTE del puesto (con su clave propia): toma el siguiente trabajo e informa el resultado.
 * Ver models/TrabajoImpresion.ts para el ciclo de vida de un trabajo.
 */

/** Un ticket que nadie tomó en este tiempo ya no se imprime (sería un papel "viejo" e inesperado). */
const VENCIMIENTO_MS = 5 * 60 * 1000;
/** Un trabajo "imprimiendo" cuyo resultado nunca llegó se puede reintentar pasado este tiempo… */
const REINTENTO_TRAS_MS = 60 * 1000;
/** …pero un solo reintento: si falló dos veces algo anda mal y es mejor avisar que imprimir en bucle. */
const MAXIMO_INTENTOS = 2;
/** Pasado este tiempo sin resultado, el usuario ve un error en lugar de esperar para siempre. */
const SIN_RESULTADO_MS = 90 * 1000;

type ConUsuario = Request & { usuario: { id: string; rol: string } };

/** ¿Está el agente conectado? La app lo consulta para avisar antes de intentar imprimir. */
export const estadoImpresion = (_req: Request, res: Response): void => {
  res.json({ agente_conectado: agenteConectado(), ultimo_contacto: fechaUltimoContacto() });
};

/**
 * Deja un ticket en la cola. Rechaza el pedido si no hay agente conectado, para no encolar algo
 * que nadie va a imprimir. Valida que el largo de la imagen coincida EXACTAMENTE con ancho × alto
 * (una imagen mal formada llegaría a la impresora como basura).
 */
export const crearTrabajo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!agenteConectado()) {
      res.status(503).json({ message: 'La impresora no está conectada en este momento', agente_conectado: false });
      return;
    }

    const ancho = Number(req.body.ancho);
    const alto = Number(req.body.alto);
    const datos = Buffer.from(String(req.body.datos), 'base64');
    if (datos.length !== (ancho / 8) * alto) {
      res.status(400).json({ message: 'El tamaño de la imagen no coincide con el ancho y el alto indicados' });
      return;
    }

    const trabajo = await TrabajoImpresion.create({
      usuario: (req as ConUsuario).usuario.id,
      remito: req.body.remito || undefined,
      ancho,
      alto,
      datos,
      vence: new Date(Date.now() + VENCIMIENTO_MS),
    });

    res.status(201).json({ id: trabajo._id, estado: trabajo.estado });
  } catch (error) {
    console.error('Error en crearTrabajo:', error);
    res.status(500).json({ message: 'Error al enviar el ticket a imprimir' });
  }
};

/**
 * Cómo va un trabajo. Lo puede ver quien lo pidió o un administrador. Los estados "vencido" y el
 * error por falta de respuesta se resuelven acá, al consultar (no hace falta un proceso aparte).
 */
export const obtenerTrabajo = async (req: Request, res: Response): Promise<void> => {
  try {
    const trabajo = await TrabajoImpresion.findById(req.params.id);
    if (!trabajo) {
      res.status(404).json({ message: 'Trabajo de impresión no encontrado' });
      return;
    }

    const { id, rol } = (req as ConUsuario).usuario;
    if (String(trabajo.usuario) !== id && rol === 'vendedor') {
      res.status(403).json({ message: 'No tienes permisos para esta acción' });
      return;
    }

    let estado = trabajo.estado;
    let error = trabajo.error;
    const ahora = Date.now();

    if (estado === 'pendiente' && trabajo.vence.getTime() < ahora) {
      estado = 'vencido';
      await TrabajoImpresion.updateOne({ _id: trabajo._id, estado: 'pendiente' }, { $set: { estado: 'vencido', finalizadoEn: new Date() }, $unset: { datos: 1 } });
    } else if (estado === 'imprimiendo' && trabajo.tomadoEn && ahora - trabajo.tomadoEn.getTime() > SIN_RESULTADO_MS) {
      estado = 'error';
      error = 'La impresora no confirmó la impresión';
      await TrabajoImpresion.updateOne({ _id: trabajo._id, estado: 'imprimiendo' }, { $set: { estado: 'error', error, finalizadoEn: new Date() }, $unset: { datos: 1 } });
    }

    res.json({ id: trabajo._id, estado, error });
  } catch (error) {
    console.error('Error en obtenerTrabajo:', error);
    res.status(500).json({ message: 'Error al consultar el trabajo de impresión' });
  }
};

/**
 * AGENTE: entrega el trabajo más antiguo pendiente (o uno "colgado" que merece un reintento) y lo
 * marca "imprimiendo" EN LA MISMA operación. Al ser atómica, dos agentes (o dos consultas
 * simultáneas) nunca reciben el mismo ticket: no hay impresiones dobles.
 * Cada consulta cuenta como señal de vida del agente. Responde 204 si no hay nada para imprimir.
 */
export const siguienteTrabajo = async (_req: Request, res: Response): Promise<void> => {
  try {
    registrarContactoAgente();
    const ahora = new Date();

    const trabajo = await TrabajoImpresion.findOneAndUpdate(
      {
        $or: [
          { estado: 'pendiente', vence: { $gt: ahora } },
          { estado: 'imprimiendo', tomadoEn: { $lt: new Date(ahora.getTime() - REINTENTO_TRAS_MS) }, intentos: { $lt: MAXIMO_INTENTOS } },
        ],
      },
      { $set: { estado: 'imprimiendo', tomadoEn: ahora }, $inc: { intentos: 1 } },
      { sort: { createdAt: 1 }, returnDocument: 'after' }
    ).select('+datos');

    if (!trabajo || !trabajo.datos) {
      res.status(204).end();
      return;
    }
    res.json({ id: trabajo._id, ancho: trabajo.ancho, alto: trabajo.alto, datos: trabajo.datos.toString('base64') });
  } catch (error) {
    console.error('Error en siguienteTrabajo:', error);
    res.status(500).json({ message: 'Error al buscar trabajos de impresión' });
  }
};

/**
 * AGENTE: informa cómo terminó. Solo se acepta si el trabajo está "imprimiendo" (no se puede
 * "terminar" dos veces ni dar por impreso algo que nunca se entregó). Se borra la imagen: ya
 * no hace falta y contiene datos del cliente.
 */
export const registrarResultado = async (req: Request, res: Response): Promise<void> => {
  try {
    registrarContactoAgente();
    const ok = req.body.ok === true;
    const ahora = new Date();
    const mensaje = String(req.body.error ?? '').trim().slice(0, 200) || 'No se pudo imprimir';

    const trabajo = await TrabajoImpresion.findOneAndUpdate(
      { _id: req.params.id, estado: 'imprimiendo' },
      ok
        ? { $set: { estado: 'impreso', finalizadoEn: ahora }, $unset: { datos: 1, error: 1 } }
        : { $set: { estado: 'error', error: mensaje, finalizadoEn: ahora }, $unset: { datos: 1 } },
      { returnDocument: 'after' }
    );

    if (!trabajo) {
      res.status(404).json({ message: 'El trabajo no existe o no estaba en curso' });
      return;
    }
    res.json({ id: trabajo._id, estado: trabajo.estado });
  } catch (error) {
    console.error('Error en registrarResultado:', error);
    res.status(500).json({ message: 'Error al registrar el resultado' });
  }
};
