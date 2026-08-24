import { Router } from 'express';
import { register, login, getProfile } from '../controllers/authController';
import { verificarToken } from '../middleware/authMiddleware';
import { limiteLogin, limiteRegistro } from '../middleware/rateLimiter';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/register',limiteRegistro, register);
router.post('/login', limiteLogin, login);

// Rutas protegidas (requieren autenticación)
router.get('/profile', verificarToken, getProfile);

export default router;