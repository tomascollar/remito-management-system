import { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit, { MemoryStore } from 'express-rate-limit';
import { registrarEvento } from '../security/eventosSeguridad';
import { describirDuracion, getConfig } from '../security/securityConfig';

/**
 * Limitadores de peticiones (rate limiting).
 *
 * Los de LOGIN y GENERAL toman sus valores de securityConfig, que el Laboratorio de seguridad
 * puede cambiar en vivo. express-rate-limit fija la ventana al crear el limitador, por eso
 * al cambiar la configuración se vuelven a construir (`reiniciarLimitadores`), lo que además
 * pone en cero los contadores. Las rutas usan los envoltorios `limiteLogin`/`limiteGeneral`,
 * que siempre delegan en el limitador vigente.
 */

interface Instancia {
  limitador: RequestHandler;
  store: MemoryStore;
}

// Límite estricto para intentos de login (previene fuerza bruta).
// Solo cuentan los intentos FALLIDOS: iniciar sesión bien no consume el cupo.
const crearLimitadorLogin = (): Instancia => {
  const { loginMax, loginVentanaSeg } = getConfig();
  const store = new MemoryStore();
  const limitador = rateLimit({
    windowMs: loginVentanaSeg * 1000,
    limit: loginMax,
    store,
    skipSuccessfulRequests: true,
    standardHeaders: true, // informa el cupo restante en los headers RateLimit-*
    legacyHeaders: false,
    // Se reconstruye a propósito al cambiar la configuración desde el laboratorio
    validate: { creationStack: false },
    handler: (req, res, _next, opciones) => {
      registrarEvento('login_bloqueado', {
        ip: req.ip,
        detalle: `Más de ${loginMax} intentos fallidos en ${describirDuracion(loginVentanaSeg)}`,
      });
      res.status(opciones.statusCode).json({
        message: `Demasiados intentos de inicio de sesión. Intentá de nuevo en ${describirDuracion(loginVentanaSeg)}.`,
      });
    },
  });
  return { limitador, store };
};

// Límite general para el resto de la API (más permisivo, previene abuso general)
const crearLimitadorGeneral = (): Instancia => {
  const { generalMax, generalVentanaSeg } = getConfig();
  const store = new MemoryStore();
  const limitador = rateLimit({
    windowMs: generalVentanaSeg * 1000,
    limit: generalMax,
    store,
    standardHeaders: true,
    legacyHeaders: false,
    // Se reconstruye a propósito al cambiar la configuración desde el laboratorio
    validate: { creationStack: false },
    handler: (req, res, _next, opciones) => {
      registrarEvento('peticiones_bloqueadas', {
        ip: req.ip,
        detalle: `Más de ${generalMax} peticiones en ${describirDuracion(generalVentanaSeg)} (${req.method} ${req.originalUrl})`,
      });
      res.status(opciones.statusCode).json({ message: 'Demasiadas peticiones desde esta IP. Intentá de nuevo más tarde.' });
    },
  });
  return { limitador, store };
};

let login = crearLimitadorLogin();
let general = crearLimitadorGeneral();

/**
 * Reconstruye los limitadores con la configuración vigente y pone los contadores en cero.
 * Se usa al cambiar parámetros desde el laboratorio y para "reiniciar contadores".
 */
export const reiniciarLimitadores = (): void => {
  login.store.shutdown(); // detiene el temporizador interno del almacén anterior
  general.store.shutdown();
  login = crearLimitadorLogin();
  general = crearLimitadorGeneral();
};

export const limiteLogin: RequestHandler = (req: Request, res: Response, next: NextFunction) => login.limitador(req, res, next);
export const limiteGeneral: RequestHandler = (req: Request, res: Response, next: NextFunction) => general.limitador(req, res, next);

// Límite para registro (previene creación masiva de cuentas). No es ajustable desde el laboratorio.
export const limiteRegistro = rateLimit({
  windowMs: 60 * 60 * 1000, // Ventana de 1 hora
  limit: 10, // Máximo 10 registros por IP en esa ventana
  message: {
    message: 'Demasiados registros desde esta dirección. Intentá de nuevo más tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
