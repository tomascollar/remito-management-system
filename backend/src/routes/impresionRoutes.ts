import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { crearTrabajo, estadoImpresion, obtenerTrabajo } from '../controllers/impresionController';
import { verificarRol, verificarToken } from '../middleware/authMiddleware';
import { manejarErroresValidacion } from '../middleware/validationMiddleware';
import { validarCrearTrabajo, validarIdTrabajo } from '../middleware/impresionValidators';

/**
 * Impresión: rutas de las PERSONAS (con sesión). Las del agente están en impresionAgenteRoutes.
 */
const router = Router();

router.use(verificarToken);
router.use(verificarRol('superadmin', 'administrador', 'vendedor'));

// Tope por USUARIO (no por IP: en el mercado todos comparten la misma conexión): frena un bucle o abuso
const limiteEnvios = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req as any).usuario?.id ?? 'sin-usuario',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { message: 'Demasiados envíos a imprimir. Esperá un momento.' },
});

router.get('/estado', estadoImpresion);

/*
 * El cuerpo (la imagen del ticket) supera el límite general de 100 kb, así que esta ruta tiene
 * su propio lector de JSON, con tope de 800 kb, y se aplica DESPUÉS de verificar la sesión:
 * quien no inició sesión no puede hacer que el servidor procese un cuerpo grande.
 */
router.post('/trabajos', limiteEnvios, express.json({ limit: '800kb' }), validarCrearTrabajo, manejarErroresValidacion, crearTrabajo);
router.get('/trabajos/:id', validarIdTrabajo, manejarErroresValidacion, obtenerTrabajo);

export default router;
