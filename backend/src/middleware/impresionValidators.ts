import { body, param } from 'express-validator';

/** La térmica de 80 mm imprime 576 puntos de ancho (72 mm a 8 puntos por mm). */
export const ANCHO_MAXIMO = 576;
/** Alto máximo: 6000 puntos ≈ 75 cm de papel. Un ticket normal usa unas 1.000 a 2.500. */
export const ALTO_MAXIMO = 6000;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const validarCrearTrabajo = [
  body('ancho')
    .isInt({ min: 8, max: ANCHO_MAXIMO }).withMessage(`El ancho debe estar entre 8 y ${ANCHO_MAXIMO} puntos`)
    .custom((v) => Number(v) % 8 === 0).withMessage('El ancho debe ser múltiplo de 8'),
  body('alto')
    .isInt({ min: 1, max: ALTO_MAXIMO }).withMessage(`El alto debe estar entre 1 y ${ALTO_MAXIMO} puntos`),
  // La imagen viaja en base64. Se verifica la forma Y, en el controlador, que el largo coincida con ancho × alto.
  body('datos')
    .isString().withMessage('La imagen es requerida')
    .matches(BASE64).withMessage('La imagen no tiene un formato válido'),
  body('remito')
    .optional({ values: 'falsy' })
    .isMongoId().withMessage('ID de remito inválido'),
];

export const validarIdTrabajo = [param('id').isMongoId().withMessage('ID de trabajo inválido')];

export const validarResultado = [
  param('id').isMongoId().withMessage('ID de trabajo inválido'),
  // Solo el booleano real, nunca un texto ("true") ni un objeto
  body('ok').isBoolean({ strict: true }).withMessage('ok debe ser verdadero o falso'),
  body('error')
    .optional({ values: 'falsy' })
    .isString().withMessage('El error debe ser texto')
    .isLength({ max: 200 }).withMessage('El error admite hasta 200 caracteres'),
];
