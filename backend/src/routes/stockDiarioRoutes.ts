import { Router } from 'express';
import {
  registrarStockDiario,
  getStockVigente,
  getStockVigentePorProducto,
  agregarStock,
  actualizarPrecioDia,
  ajustarStock
} from '../controllers/stockDiarioController';
import { getMovimientos } from '../controllers/movimientoStockController';
import { validarListarMovimientos } from '../middleware/movimientoStockValidators';
import { verificarToken, verificarRol } from '../middleware/authMiddleware';
import { manejarErroresValidacion } from '../middleware/validationMiddleware';
import {
  validarRegistrarStock,
  validarProductoIdParam,
  validarAgregarStock,
  validarActualizarPrecio,
  validarAjusteStock
} from '../middleware/stockDiarioValidators';

const router = Router();

router.use(verificarToken);

router.get('/', getStockVigente);

// Historial de movimientos (auditoría): solo administración. Debe ir ANTES de '/:productoId'.
router.get(
  '/movimientos',
  verificarRol('superadmin', 'administrador'),
  validarListarMovimientos,
  manejarErroresValidacion,
  getMovimientos
);

router.get('/:productoId', validarProductoIdParam, manejarErroresValidacion, getStockVigentePorProducto);

router.post(
  '/',
  verificarRol('superadmin', 'administrador'),
  validarRegistrarStock,
  manejarErroresValidacion,
  registrarStockDiario
);

router.patch(
  '/:productoId/agregar',
  verificarRol('superadmin', 'administrador'),
  validarAgregarStock,
  manejarErroresValidacion,
  agregarStock
);

router.patch(
  '/:productoId/precio',
  verificarRol('superadmin', 'administrador'),
  validarActualizarPrecio,
  manejarErroresValidacion,
  actualizarPrecioDia
);

router.patch(
  '/:productoId/ajuste',
  verificarRol('superadmin', 'administrador'),
  validarAjusteStock,
  manejarErroresValidacion,
  ajustarStock
);

export default router;