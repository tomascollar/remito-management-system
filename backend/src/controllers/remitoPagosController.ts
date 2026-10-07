import { Request, Response } from 'express';
import Remito from '../models/Remito';
import { calcularTotal, redondear } from '../services/cobranzas';

// ---------------------------------------------------------------------------
// Ajustes: líneas sin producto ni stock (saldo anterior, descuento, recargo…)
// ---------------------------------------------------------------------------

/**
 * Agrega un ajuste al remito. Monto positivo = suma al total (ej: "Saldo anterior");
 * negativo = lo reduce (ej: "Descuento por cantidad", "Vacíos devueltos").
 * `resaltado` hace que la línea se destaque en el comprobante. Solo con el remito abierto,
 * igual que los productos. El total nunca puede quedar negativo.
 */
export const agregarAjuste = async (req: Request, res: Response): Promise<void> => {
  try {
    const remito = await Remito.findById(req.params.id);
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }
    if (remito.estado === 'cerrado') {
      res.status(400).json({ message: 'El remito está cerrado, no se pueden agregar ajustes' });
      return;
    }

    const monto = redondear(Number(req.body.monto));
    const concepto = String(req.body.concepto).trim();

    // Se verifica el total ANTES de tocar el documento
    const nuevoTotal = calcularTotal(remito.items, [...remito.ajustes, { monto }]);
    if (nuevoTotal < 0) {
      res.status(400).json({ message: 'El ajuste dejaría el total del remito en negativo' });
      return;
    }

    remito.ajustes.push({ concepto, monto, resaltado: req.body.resaltado === true } as any);
    remito.total = nuevoTotal;
    await remito.save();

    res.status(201).json({ message: 'Ajuste agregado exitosamente', remito });
  } catch (error) {
    console.error('Error en agregarAjuste:', error);
    res.status(500).json({ message: 'Error al agregar el ajuste' });
  }
};

/** Quita un ajuste (solo con el remito abierto) y recalcula el total. */
export const quitarAjuste = async (req: Request, res: Response): Promise<void> => {
  try {
    const remito = await Remito.findById(req.params.id);
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }
    if (remito.estado === 'cerrado') {
      res.status(400).json({ message: 'El remito está cerrado, no se pueden quitar ajustes' });
      return;
    }

    const ajuste = (remito.ajustes as any).id(req.params.ajusteId);
    if (!ajuste) {
      res.status(404).json({ message: 'Ajuste no encontrado en el remito' });
      return;
    }

    const restantes = remito.ajustes.filter((a: any) => a._id.toString() !== req.params.ajusteId);
    const nuevoTotal = calcularTotal(remito.items, restantes);
    if (nuevoTotal < 0) {
      res.status(400).json({ message: 'Quitar este ajuste dejaría el total del remito en negativo' });
      return;
    }

    (remito.ajustes as any).pull(req.params.ajusteId);
    remito.total = nuevoTotal;
    await remito.save();

    res.json({ message: 'Ajuste quitado exitosamente', remito });
  } catch (error) {
    console.error('Error en quitarAjuste:', error);
    res.status(500).json({ message: 'Error al quitar el ajuste' });
  }
};

// ---------------------------------------------------------------------------
// Entregas: pagos a cuenta
// ---------------------------------------------------------------------------

/**
 * Registra una entrega (pago a cuenta). Se permite también con el remito cerrado: el cliente
 * suele pagar después de retirar. No puede superar el saldo pendiente (no se aceptan pagos
 * de más). Queda registrado quién la cargó y cuándo.
 */
export const registrarEntrega = async (req: Request, res: Response): Promise<void> => {
  try {
    const remito = await Remito.findById(req.params.id);
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }

    const monto = redondear(Number(req.body.monto));
    const saldo = remito.saldo;

    if (saldo <= 0) {
      res.status(400).json({ message: 'El remito no tiene saldo pendiente' });
      return;
    }
    if (monto > saldo) {
      res.status(400).json({ message: `La entrega supera el saldo pendiente (${saldo})` });
      return;
    }

    remito.entregas.push({
      monto,
      fecha: new Date(),
      usuario: (req as any).usuario.id,
      nota: req.body.nota ? String(req.body.nota).trim() : undefined,
      anulada: false
    } as any);
    await remito.save();

    res.status(201).json({ message: 'Entrega registrada exitosamente', remito });
  } catch (error) {
    console.error('Error en registrarEntrega:', error);
    res.status(500).json({ message: 'Error al registrar la entrega' });
  }
};

/**
 * Anula una entrega cargada por error. NO se borra: queda marcada con quién y cuándo la anuló
 * (rastro de auditoría), y deja de contar para lo entregado.
 */
export const anularEntrega = async (req: Request, res: Response): Promise<void> => {
  try {
    const remito = await Remito.findById(req.params.id);
    if (!remito) {
      res.status(404).json({ message: 'Remito no encontrado' });
      return;
    }

    const entrega = (remito.entregas as any).id(req.params.entregaId);
    if (!entrega) {
      res.status(404).json({ message: 'Entrega no encontrada en el remito' });
      return;
    }
    if (entrega.anulada) {
      res.status(400).json({ message: 'La entrega ya está anulada' });
      return;
    }

    entrega.anulada = true;
    entrega.anulada_por = (req as any).usuario.id;
    entrega.anulada_fecha = new Date();
    await remito.save();

    res.json({ message: 'Entrega anulada exitosamente', remito });
  } catch (error) {
    console.error('Error en anularEntrega:', error);
    res.status(500).json({ message: 'Error al anular la entrega' });
  }
};
