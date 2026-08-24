import rateLimit from 'express-rate-limit';

// Límite estricto para intentos de login (previene fuerza bruta)
export const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
  max: 5, // Máximo 5 intentos por IP en esa ventana
  message: {
    message: 'Demasiados intentos de inicio de sesión. Intentá de nuevo en 15 minutos.'
  },
  standardHeaders: true, // Devuelve info del límite en headers RateLimit-*
  legacyHeaders: false
});

// Límite para registro (previene creación masiva de cuentas)
export const limiteRegistro = rateLimit({
  windowMs: 60 * 60 * 1000, // Ventana de 1 hora
  max: 10, // Máximo 10 registros por IP en esa ventana
  message: {
    message: 'Demasiados registros desde esta dirección. Intentá de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Límite general para el resto de la API (más permisivo, previene abuso general)
export const limiteGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // 200 peticiones cada 15 minutos por IP
  message: {
    message: 'Demasiadas peticiones desde esta IP. Intentá de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});