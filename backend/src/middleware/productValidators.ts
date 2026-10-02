import { body, param } from 'express-validator';
import { CATEGORIAS, UNIDADES_STOCK } from '../constants/catalogos';

export const validarCrearProducto = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .not().matches(/[<>]/).withMessage('El nombre no puede contener < ni >'),

    // Lista blanca: solo valores del catálogo. Evita variantes por errores de tipeo
  // ("bosla") que romperían el listado y la búsqueda.
  body('categoria')
    .optional({ checkFalsy: true }) // vacío = sin categoría
    .isIn([...CATEGORIAS]).withMessage('Categoría inválida'),

    body('unidad_stock')
    .optional({ checkFalsy: true }) // si no viene, el controller usa 'Bulto'
    .isIn([...UNIDADES_STOCK]).withMessage('Unidad de stock inválida'),

    
  body('permite_venta_fraccionada')
    .optional()
    .isBoolean().withMessage('permite_venta_fraccionada debe ser true o false'),


  // Si viene igual (aunque no sea obligatoria), que sea válida
  body('cantidad_por_bulto')
    .optional({ checkFalsy: true })
    .isFloat({ gt: 0 }).withMessage('La cantidad por bulto debe ser un número mayor a 0')
];

export const validarActualizarProducto = [
  param('id')
    .isMongoId().withMessage('ID de producto inválido'),

  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),

  body('categoria')
    .optional({ checkFalsy: true })
    .isIn([...CATEGORIAS]).withMessage('Categoría inválida'),

    body('unidad_stock')
    .optional()
    .isIn([...UNIDADES_STOCK]).withMessage('Unidad de stock inválida'),

  body('permite_venta_fraccionada')
    .optional()
    .isBoolean().withMessage('permite_venta_fraccionada debe ser true o false'),

  body('cantidad_por_bulto')
    .optional({ checkFalsy: true })
    .isFloat({ gt: 0 }).withMessage('La cantidad por bulto debe ser un número mayor a 0')
];

export const validarIdProducto = [
  param('id').isMongoId().withMessage('ID de producto inválido')
];

//.trim() quita espacios innecesarioss al inici/fin
//.escape convierte caracteres como & a su forma segura, evitando q alguien guarde algo como <script>...</script>
//como nombre de producto
//.isMongoId valida que el ID de la URL tenga el formagot correcto de MongoDB antes de consultar la db