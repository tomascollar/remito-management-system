import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  reactivateProduct,
  permanentDeleteProduct
} from '../controllers/productController';
import { verificarToken, verificarRol } from '../middleware/authMiddleware';
import { manejarErroresValidacion } from '../middleware/validationMiddleware';
import {
  validarCrearProducto,
  validarActualizarProducto,
  validarIdProducto
} from '../middleware/productValidators';

const router = Router();

// Todas las rutas requieren estar autenticado
router.use(verificarToken);

// Lectura: cualquier usuario autenticado
router.get('/', getAllProducts);
router.get('/:id', validarIdProducto, manejarErroresValidacion, getProductById);

// Escritura: solo superadmin y administrador
router.post(
  '/',
  verificarRol('superadmin', 'administrador'),
  validarCrearProducto,
  manejarErroresValidacion,
  createProduct
);

router.put(
  '/:id',
  verificarRol('superadmin', 'administrador'),
  validarActualizarProducto,
  manejarErroresValidacion,
  updateProduct
);

router.patch(
  '/:id/desactivar',
  verificarRol('superadmin', 'administrador'),
  validarIdProducto,
  manejarErroresValidacion,
  deleteProduct
);

router.patch(
  '/:id/reactivar',
  verificarRol('superadmin', 'administrador'),
  validarIdProducto,
  manejarErroresValidacion,
  reactivateProduct
);

// Eliminación permanente: solo superadmin
router.delete(
  '/:id',
  verificarRol('superadmin'),
  validarIdProducto,
  manejarErroresValidacion,
  permanentDeleteProduct
);

export default router;

//autenticación → autorización por rol → validación de datos → controller.
//  Esta cadena de "fail-fast" (cortar lo antes posible ante cualquier problema) es justamente el tipo de decisión
//  de diseño deseado para documentar y explicar

