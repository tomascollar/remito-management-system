import { Router } from 'express';
import { getRemitos } from '../controllers/remitoListado';
import { validarListarRemitos } from '../middleware/remitoListadoValidators';

import {
  crearRemito,
  agregarItem,
  quitarItem,
  cerrarRemito,
  reabrirRemito,
  getRemitoById,
  modificarCantidadItem
} from '../controllers/remitoController';
import {
  agregarAjuste,
  quitarAjuste,
  registrarEntrega,
  anularEntrega
} from '../controllers/remitoPagosController';
import { verificarToken, verificarRol } from '../middleware/authMiddleware';
import { manejarErroresValidacion } from '../middleware/validationMiddleware';
import {
  validarCrearRemito,
  validarAgregarItem,
  validarQuitarItem,
  validarIdRemito,
  validarModificarItem,
  validarAgregarAjuste,
  validarQuitarAjuste,
  validarRegistrarEntrega,
  validarAnularEntrega
} from '../middleware/remitoValidators';

const router = Router();

router.use(verificarToken);

// Lectura: cualquier usuario autenticado
router.get('/', validarListarRemitos, manejarErroresValidacion, getRemitos);
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

router.patch(
  '/:id/items/:itemId',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarModificarItem,
  manejarErroresValidacion,
  modificarCantidadItem
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

// Ajustes (saldo anterior, descuentos…): solo con el remito abierto
router.post(
  '/:id/ajustes',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarAgregarAjuste,
  manejarErroresValidacion,
  agregarAjuste
);

router.delete(
  '/:id/ajustes/:ajusteId',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarQuitarAjuste,
  manejarErroresValidacion,
  quitarAjuste
);

// Entregas (pagos a cuenta): también con el remito cerrado. Se anulan, no se borran.
router.post(
  '/:id/entregas',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarRegistrarEntrega,
  manejarErroresValidacion,
  registrarEntrega
);

router.patch(
  '/:id/entregas/:entregaId/anular',
  verificarRol('superadmin', 'administrador', 'vendedor'),
  validarAnularEntrega,
  manejarErroresValidacion,
  anularEntrega
);

export default router;