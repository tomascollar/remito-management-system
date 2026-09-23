import { body } from 'express-validator';

export const validarLogin = [
  body('email')
    .trim()
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
];