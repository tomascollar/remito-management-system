import { query } from 'express-validator';

// Parámetros del listado: todos opcionales; los inválidos se rechazan con 400
export const validarListarRemitos = [
  query('pagina').optional().isInt({ min: 1, max: 100000 }).withMessage('pagina debe ser un entero mayor a 0'),
  query('limite').optional().isInt({ min: 1, max: 50 }).withMessage('limite debe estar entre 1 y 50'),
  query('estado').optional().isIn(['abierto', 'cerrado']).withMessage('estado debe ser "abierto" o "cerrado"'),
  query('vendedor').optional().isMongoId().withMessage('vendedor inválido'),
  query('fecha_desde').optional().isISO8601().withMessage('fecha_desde debe ser una fecha ISO'),
  query('fecha_hasta').optional().isISO8601().withMessage('fecha_hasta debe ser una fecha ISO'),
  query('orden').optional().isIn(['recientes', 'alfabetico']).withMessage('orden debe ser "recientes" o "alfabetico"'),
  query('q').optional().isString().isLength({ max: 100 }).withMessage('La búsqueda admite hasta 100 caracteres')
];
