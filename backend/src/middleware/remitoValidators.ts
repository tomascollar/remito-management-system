import { body, param } from 'express-validator';
import { formatearNombre } from '../services/formatoNombre';

export const validarCrearRemito = [
  body('nombre_cliente')
    .trim()
    .notEmpty().withMessage('El nombre del cliente es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
    // Se guarda siempre como "Nombre" (primera letra en mayúscula, el resto en minúscula), como lo escriba el usuario
    .customSanitizer(formatearNombre)
];

export const validarAgregarItem = [
  param('id').isMongoId().withMessage('ID de remito inválido'),

  body('producto')
    .isMongoId().withMessage('ID de producto inválido'),

  body('cantidad')
    .isFloat({ gt: 0, lt: 100000 }).withMessage('La cantidad debe ser un número mayor a 0 y menor a 100.000'),

  body('unidad_venta')
    .isIn(['bulto', 'unidad']).withMessage('unidad_venta debe ser "bulto" o "unidad"'),

  // Solo el booleano real (un texto como "true" se rechaza)
  body('precio_x_bulto')
    .optional()
    .isBoolean({ strict: true }).withMessage('precio_x_bulto debe ser verdadero o falso')
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
    .isFloat({ gt: 0, lt: 100000 }).withMessage('La cantidad debe ser un número mayor a 0 y menor a 100.000')
];

// Texto libre que se guarda tal cual: se rechazan < y > (se escapa al mostrar, no al guardar)
const SIN_ETIQUETAS = /^[^<>]*$/;

export const validarAgregarAjuste = [
  param('id').isMongoId().withMessage('ID de remito inválido'),
  body('concepto')
    .isString().withMessage('El concepto es requerido')
    .trim()
    .notEmpty().withMessage('El concepto es requerido')
    .isLength({ max: 100 }).withMessage('El concepto admite hasta 100 caracteres')
    .matches(SIN_ETIQUETAS).withMessage('El concepto no puede contener < ni >'),
  body('monto')
    .isFloat({ gt: -100000000, lt: 100000000 }).withMessage('El monto debe ser un número válido')
    .custom((v) => Number(v) !== 0).withMessage('El monto no puede ser 0'),
  // Solo el booleano real: un texto como "true" o un objeto se rechaza
  body('resaltado')
    .optional()
    .isBoolean({ strict: true }).withMessage('resaltado debe ser verdadero o falso')
];

export const validarQuitarAjuste = [
  param('id').isMongoId().withMessage('ID de remito inválido'),
  param('ajusteId').isMongoId().withMessage('ID de ajuste inválido')
];

export const validarRegistrarEntrega = [
  param('id').isMongoId().withMessage('ID de remito inválido'),
  body('monto')
    .isFloat({ gt: 0, lt: 100000000 }).withMessage('El monto debe ser un número mayor a 0'),
  body('nota')
    .optional({ values: 'falsy' })
    .isString().withMessage('La nota debe ser texto')
    .trim()
    .isLength({ max: 100 }).withMessage('La nota admite hasta 100 caracteres')
    .matches(SIN_ETIQUETAS).withMessage('La nota no puede contener < ni >')
];

export const validarAnularEntrega = [
  param('id').isMongoId().withMessage('ID de remito inválido'),
  param('entregaId').isMongoId().withMessage('ID de entrega inválido')
];
