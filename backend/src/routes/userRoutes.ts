import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  permanentDeleteUser
} from '../controllers/userController';
import { verificarToken, verificarRol } from '../middleware/authMiddleware';
import { manejarErroresValidacion } from '../middleware/validationMiddleware';
import {
  validarCrearUsuario,
  validarActualizarUsuario,
  validarIdUsuario
} from '../middleware/userValidators';

const router = Router();

router.use(verificarToken);
router.use(verificarRol('superadmin'));

router.get('/', getAllUsers);
router.get('/:id', validarIdUsuario, manejarErroresValidacion, getUserById);
router.post('/', validarCrearUsuario, manejarErroresValidacion, createUser);
router.put('/:id', validarActualizarUsuario, manejarErroresValidacion, updateUser);
router.patch('/:id/desactivar', validarIdUsuario, manejarErroresValidacion, deleteUser);
router.delete('/:id', validarIdUsuario, manejarErroresValidacion, permanentDeleteUser);

export default router;