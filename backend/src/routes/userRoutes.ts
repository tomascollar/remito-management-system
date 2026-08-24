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

const router = Router();

// Todo este módulo requiere estar autenticado y ser superadmin
router.use(verificarToken);
router.use(verificarRol('superadmin'));

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/desactivar', deleteUser);
router.delete('/:id', permanentDeleteUser);

export default router;