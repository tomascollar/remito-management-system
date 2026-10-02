import { body, param } from 'express-validator';

export const validarCrearRemito = [
  body('nombre_cliente')
    .trim()
    .notEmpty().withMessage('El nombre del cliente es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
  
];

export const validarAgregarItem = [
  param('id').isMongoId().withMessage('ID de remito inválido'),

  body('producto')
    .isMongoId().withMessage('ID de producto inválido'),

  body('cantidad')
    .isFloat({ gt: 0 }).withMessage('La cantidad debe ser un número mayor a 0'),

  body('unidad_venta')
    .isIn(['bulto', 'unidad']).withMessage('unidad_venta debe ser "bulto" o "unidad"')
];

export const validarQuitarItem = [
  param('id').isMongoId().withMessage('ID de remito inválido'),
  param('itemId').isMongoId().withMessage('ID de ítem inválido')
];

export const validarIdRemito = [
  param('id').isMongoId().withMessage('ID de remito inválido')
];

export const validarModificarItem = [
  param('id').isMongoId().withMessage('ID de remito inválido'),
  param('itemId').isMongoId().withMessage('ID de ítem inválido'),
  body('cantidad')
    .isFloat({ gt: 0 }).withMessage('La cantidad debe ser un número mayor a 0')
];