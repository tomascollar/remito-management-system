import { Router } from 'express';
import { login, getProfile } from '../controllers/authController';
import { verificarToken } from '../middleware/authMiddleware';
import { limiteLogin } from '../middleware/rateLimiter';
import { manejarErroresValidacion } from '../middleware/validationMiddleware';
import { validarLogin } from '../middleware/authValidators';

const router = Router();

router.post('/login', limiteLogin, validarLogin, manejarErroresValidacion, login);
router.get('/profile', verificarToken, getProfile);

export default router;