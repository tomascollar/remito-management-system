import { Router } from 'express';
import { registrarResultado, siguienteTrabajo } from '../controllers/impresionController';
import { manejarErroresValidacion } from '../middleware/validationMiddleware';
import { validarResultado } from '../middleware/impresionValidators';

/**
 * Impresión: rutas del AGENTE (el programa del puesto). Se montan en app.ts con los límites y la
 * verificación de su clave (verificarAgente) por delante. No usan sesión de usuario.
 */
const router = Router();

// POST (no GET) porque cada consulta CAMBIA el estado del trabajo que entrega
router.post('/siguiente', siguienteTrabajo);
router.post('/trabajos/:id/resultado', validarResultado, manejarErroresValidacion, registrarResultado);

export default router;
