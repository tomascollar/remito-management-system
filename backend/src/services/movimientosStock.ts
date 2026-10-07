import mongoose from 'mongoose';
import MovimientoStock, { TipoMovimiento } from '../models/MovimientoStock';

interface DatosMovimiento {
  producto: mongoose.Types.ObjectId | string;
  tipo: TipoMovimiento;
  cantidad_bultos: number; // negativo = sale stock, positivo = entra stock
  usuario: string;
  remito?: mongoose.Types.ObjectId | string;
  observaciones?: string;
}

/**
 * Deja asentado un movimiento de stock en el historial (auditoría).
 *
 * Es "mejor esfuerzo": si falla el guardado se informa por consola pero NO se cancela la
 * operación principal. Así un problema en el registro de auditoría no impide vender.
 * (Limitación a documentar: el cambio de stock y su registro no son atómicos; para eso
 * haría falta una transacción de MongoDB.)
 */
export const registrarMovimiento = async (datos: DatosMovimiento): Promise<void> => {
  if (datos.cantidad_bultos === 0) return; // no hubo cambio real, no hay nada que registrar
  try {
    await MovimientoStock.create({ fecha: new Date(), ...datos });
  } catch (error) {
    console.error('No se pudo registrar el movimiento de stock:', error);
  }
};
