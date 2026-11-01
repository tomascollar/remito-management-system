import { body, param } from 'express-validator';

export const validarRegistrarStock = [
  body('producto')
    .isMongoId().withMessage('ID de producto inválido'),

  body('cantidad_bultos_inicial')
    .isFloat({ gt: 0 }).withMessage('La cantidad inicial debe ser un número mayor a 0'),

  body('precio_bulto')
    .isFloat({ gt: 0 }).withMessage('El precio por bulto debe ser un número mayor a 0'),

  body('precio_unidad')
    .optional()
    .isFloat({ gt: 0 }).withMessage('El precio por unidad debe ser un número mayor a 0'),

  body('precio_unidad_x_bulto')
    .optional()
    .isFloat({ gt: 0 }).withMessage('El precio de unidad por bulto debe ser un número mayor a 0')
];

export const validarProductoIdParam = [
  param('productoId').isMongoId().withMessage('ID de producto inválido')
];

export const validarAgregarStock = [
  param('productoId').isMongoId().withMessage('ID de producto inválido'),
  body('cantidad_bultos')
    .isFloat({ gt: 0 }).withMessage('La cantidad a agregar debe ser un número mayor a 0'),
  body('observaciones')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Las observaciones no pueden superar 200 caracteres')
];

export const validarActualizarPrecio = [
  param('productoId').isMongoId().withMessage('ID de producto inválido'),
  body('precio_bulto')
    .optional()
    .isFloat({ gt: 0 }).withMessage('El precio por bulto debe ser un número mayor a 0'),
  body('precio_unidad')
    .optional()
    .isFloat({ gt: 0 }).withMessage('El precio por unidad debe ser un número mayor a 0'),
  body('precio_unidad_x_bulto')
    .optional()
    .isFloat({ gt: 0 }).withMessage('El precio de unidad por bulto debe ser un número mayor a 0')
];

export const validarAjusteStock = [
  param('productoId').isMongoId().withMessage('ID de producto inválido'),
  body('cantidad_bultos')
    .isFloat().withMessage('La cantidad debe ser un número')
    .not().equals('0').withMessage('La cantidad de ajuste no puede ser 0'),
  body('observaciones')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Las observaciones no pueden superar 200 caracteres')

];