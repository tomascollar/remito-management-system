import { body, query } from 'express-validator';
import { COSTO_BCRYPT, LIMITES } from '../security/securityConfig';

// Cada parámetro de configuración es opcional, pero si viene debe ser un entero dentro de su rango
const parametro = (nombre: keyof typeof LIMITES) => {
  const [min, max] = LIMITES[nombre];
  return body(nombre).optional().isInt({ min, max }).withMessage(`${nombre} debe ser un entero entre ${min} y ${max}`).toInt();
};

export const validarConfig = [
  parametro('loginMax'),
  parametro('loginVentanaSeg'),
  parametro('generalMax'),
  parametro('generalVentanaSeg'),
  parametro('jwtDuracionSeg'),
];

export const validarTokenDemo = [
  body('duracionSeg').optional().isInt({ min: 5, max: 86400 }).withMessage('duracionSeg debe estar entre 5 y 86400').toInt(),
];

export const validarBcrypt = [
  body('costo')
    .isInt({ min: COSTO_BCRYPT[0], max: COSTO_BCRYPT[1] })
    .withMessage(`costo debe ser un entero entre ${COSTO_BCRYPT[0]} y ${COSTO_BCRYPT[1]}`)
    .toInt(),
];

export const validarEventos = [
  query('desde_id').optional().isInt({ min: 0 }),
  query('tipo')
    .optional()
    .isIn([
      'login_ok', 'login_fallido', 'login_bloqueado', 'peticiones_bloqueadas', 'token_expirado',
      'token_invalido', 'acceso_denegado', 'config_cambiada', 'contadores_reiniciados',
    ])
    .withMessage('tipo de evento inválido'),
];
