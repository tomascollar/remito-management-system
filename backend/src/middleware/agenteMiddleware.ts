import { createHash, timingSafeEqual } from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { registrarEvento } from '../security/eventosSeguridad';

/**
 * Seguridad del AGENTE de impresión (el programa que corre en el puesto).
 *
 * El agente no es una persona: no tiene usuario ni contraseña ni rol. Se identifica con una clave
 * propia (IMPRESION_AGENTE_TOKEN) distinta de los tokens de sesión, y con ella solo puede hacer
 * dos cosas: pedir el siguiente trabajo e informar cómo terminó. Nada más de la API.
 *
 * Si la variable no está definida, la función de impresión queda desactivada y estas rutas
 * responden 404 como si no existieran.
 */

/** Largo mínimo de la clave: una clave corta se adivina por fuerza bruta. */
export const LARGO_MINIMO_TOKEN = 32;

const huella = (texto: string) => createHash('sha256').update(texto).digest();

/**
 * Compara la clave recibida con la esperada en TIEMPO CONSTANTE. Una comparación común (===)
 * termina antes cuanto antes difiere un carácter, y midiendo esos tiempos se podría ir
 * descubriendo la clave letra por letra. Se comparan las huellas SHA-256 (siempre del mismo
 * largo, que es lo que exige timingSafeEqual).
 */
export const claveValida = (recibida: string, esperada: string): boolean => timingSafeEqual(huella(recibida), huella(esperada));

/** Exige la clave del agente. Se lee en cada petición para que se pueda rotar con un reinicio. */
export const verificarAgente: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const esperada = process.env.IMPRESION_AGENTE_TOKEN;
  if (!esperada || esperada.length < LARGO_MINIMO_TOKEN) {
    res.status(404).json({ message: 'Ruta no encontrada' }); // función desactivada o mal configurada
    return;
  }

  const encabezado = req.header('Authorization') ?? '';
  const recibida = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : '';
  if (!recibida || !claveValida(recibida, esperada)) {
    registrarEvento('token_invalido', {
      ip: req.ip,
      detalle: `Clave de agente de impresión incorrecta o ausente (${req.method} ${req.originalUrl})`,
    });
    res.status(401).json({ message: 'Agente no autorizado' });
    return;
  }
  next();
};

/**
 * Límites para las rutas del agente. Se montan ANTES del límite general porque el agente consulta
 * seguido y no debe gastar el cupo de las personas que usan la app desde la misma red.
 */

// Ritmo normal: el agente consulta cada pocos segundos; esto deja mucho margen y frena abusos.
export const limiteAgente = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, opciones) => {
    registrarEvento('peticiones_bloqueadas', { ip: req.ip, detalle: `Demasiadas peticiones al agente de impresión (${req.method} ${req.originalUrl})` });
    res.status(opciones.statusCode).json({ message: 'Demasiadas peticiones' });
  },
});

// Intentos con clave incorrecta: solo cuentan los FALLIDOS (como en el login), para frenar la fuerza bruta.
export const limiteFallosAgente = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, opciones) => {
    registrarEvento('login_bloqueado', { ip: req.ip, detalle: 'Demasiados intentos fallidos con clave de agente de impresión' });
    res.status(opciones.statusCode).json({ message: 'Demasiados intentos. Intentá más tarde.' });
  },
});
