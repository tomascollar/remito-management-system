import { body, param } from 'express-validator';

const rolesValidos = ['superadmin', 'administrador', 'vendedor'];

export const validarCrearUsuario = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
 

  body('email')
    .trim()
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),

  body('rol')
    .optional()
    .isIn(rolesValidos).withMessage(`El rol debe ser uno de: ${rolesValidos.join(', ')}`)
];

export const validarActualizarUsuario = [
  param('id').isMongoId().withMessage('ID de usuario inválido'),

  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),

  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),

  body('password')
    .optional()
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),

  body('rol')
    .optional()
    .isIn(rolesValidos).withMessage(`El rol debe ser uno de: ${rolesValidos.join(', ')}`),

  body('activo')
    .optional()
    .isBoolean().withMessage('activo debe ser true o false')
];

export const validarIdUsuario = [
  param('id').isMongoId().withMessage('ID de usuario inválido')
];