import { body, param } from 'express-validator';

export const validarCrearProducto = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .escape(),

  body('categoria')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('La categoría no puede superar 50 caracteres')
    .escape(),

  body('unidad_stock')
    .trim()
    .notEmpty().withMessage('La unidad de stock es requerida')
    .isLength({ max: 30 }).withMessage('Unidad de stock inválida')
    .escape(),

  body('permite_venta_fraccionada')
    .optional()
    .isBoolean().withMessage('permite_venta_fraccionada debe ser true o false'),

  // cantidad_por_bulto: solo se valida como obligatoria si permite_venta_fraccionada es true
  body('cantidad_por_bulto')
    .if(body('permite_venta_fraccionada').equals('true'))
    .notEmpty().withMessage('La cantidad por bulto es requerida cuando el producto permite venta fraccionada')
    .bail()
    .isFloat({ gt: 0 }).withMessage('La cantidad por bulto debe ser un número mayor a 0'),

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
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .escape(),

  body('categoria')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('La categoría no puede superar 50 caracteres')
    .escape(),

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