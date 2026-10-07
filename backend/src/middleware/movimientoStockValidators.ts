import { query } from 'express-validator';
import { TIPOS_MOVIMIENTO } from '../models/MovimientoStock';

// Parámetros del historial de stock: todos opcionales; los inválidos se rechazan con 400
export const validarListarMovimientos = [
  query('pagina').optional().isInt({ min: 1, max: 100000 }).withMessage('pagina debe ser un entero mayor a 0'),
  query('limite').optional().isInt({ min: 1, max: 50 }).withMessage('limite debe estar entre 1 y 50'),
  query('producto').optional().isMongoId().withMessage('producto inválido'),
  query('usuario').optional().isMongoId().withMessage('usuario inválido'),
  query('tipo').optional().isIn([...TIPOS_MOVIMIENTO]).withMessage('tipo de movimiento inválido'),
  query('fecha_desde').optional().isISO8601().withMessage('fecha_desde debe ser una fecha ISO'),
  query('fecha_hasta').optional().isISO8601().withMessage('fecha_hasta debe ser una fecha ISO')
];
