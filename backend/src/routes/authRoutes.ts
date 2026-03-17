import { Router } from 'express';
import { register, login, getProfile } from '../controllers/authController';
import { verificarToken } from '../middleware/authMiddleware';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/register', register);
router.post('/login', login);

// Rutas protegidas (requieren autenticación)
router.get('/profile', verificarToken, getProfile);

export default router;