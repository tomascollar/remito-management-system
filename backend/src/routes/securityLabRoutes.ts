import { Router } from 'express';
import {
  actualizarConfig,
  borrarEventos,
  crearGetPermisos,
  emitirTokenDemo,
  getEstado,
  getEventos,
  medirBcrypt,
  reiniciarContadores,
  restaurar,
} from '../controllers/securityLabController';
import { verificarRol, verificarToken } from '../middleware/authMiddleware';
import { manejarErroresValidacion } from '../middleware/validationMiddleware';
import { validarBcrypt, validarConfig, validarEventos, validarTokenDemo } from '../middleware/securityLabValidators';
import authRoutes from './authRoutes';
import productRoutes from './productRoutes';
import remitoRoutes from './remitoRoutes';
import stockDiarioRoutes from './stockDiarioRoutes';
import userRoutes from './userRoutes';

/**
 * Rutas del Laboratorio de seguridad. Se montan en server.ts SOLO si SECURITY_LAB=true,
 * y además exigen sesión y rol superadmin.
 */
const router = Router();

router.use(verificarToken);
router.use(verificarRol('superadmin'));

router.get('/estado', getEstado);
router.put('/config', validarConfig, manejarErroresValidacion, actualizarConfig);
router.post('/config/restaurar', restaurar);
router.post('/contadores/reiniciar', reiniciarContadores);
router.post('/token-demo', validarTokenDemo, manejarErroresValidacion, emitirTokenDemo);
router.post('/bcrypt', validarBcrypt, manejarErroresValidacion, medirBcrypt);
router.get('/eventos', validarEventos, manejarErroresValidacion, getEventos);
router.delete('/eventos', borrarEventos);
router.get(
  '/permisos',
  crearGetPermisos([
    { prefijo: '/api/auth', router: authRoutes },
    { prefijo: '/api/products', router: productRoutes },
    { prefijo: '/api/stock-diario', router: stockDiarioRoutes },
    { prefijo: '/api/remitos', router: remitoRoutes },
    { prefijo: '/api/users', router: userRoutes },
  ])
);

export default router;
