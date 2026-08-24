import { Router } from 'express';
import {
  crearRemito,
  agregarItem,
  quitarItem,
  cerrarRemito,
  reabrirRemito,
  getRemitos,
  getRemitoById
} from '../controllers/remitoController';
import { verificarToken, verificarRol } from '../middleware/authMiddleware';
import { manejarErroresValidacion } from '../middleware/validationMiddleware';
import {
  validarCrearRemito,
  validarAgregarItem,
  validarQuitarItem,
  validarIdRemito
} from '../middleware/remitoValidators';

const router = Router();

router.use(verificarToken);

// Lectura: cualquier usuario autenticado
router.get('/', getRemitos);
router.get('/:id', validarIdRemito, manejarErroresValidacion, getRemitoById);

// Escritura: vendedor, administrador y superadmin (son quienes generan ventas)
router.post(
  '/',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarCrearRemito,
  manejarErroresValidacion,
  crearRemito
);

router.post(
  '/:id/items',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarAgregarItem,
  manejarErroresValidacion,
  agregarItem
);

router.delete(
  '/:id/items/:itemId',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarQuitarItem,
  manejarErroresValidacion,
  quitarItem
);

router.patch(
  '/:id/cerrar',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarIdRemito,
  manejarErroresValidacion,
  cerrarRemito
);

router.patch(
  '/:id/reabrir',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarIdRemito,
  manejarErroresValidacion,
  reabrirRemito
);

export default router;