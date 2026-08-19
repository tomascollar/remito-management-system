import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const manejarErroresValidacion = (req: Request, res: Response, next: NextFunction): void => {
  const errores = validationResult(req);

  if (!errores.isEmpty()) {
    res.status(400).json({
      message: 'Error de validación',
      errores: errores.array().map(err => ({
        campo: err.type === 'field' ? err.path : undefined,
        mensaje: err.msg
      }))
    });
    return;
  }

  next();
};

//validationResult(req) recolecta todos los errores que hayan detectado las reglas de validación 
// que definamos por ruta. Si hay errores, corta la petición con un 400 antes de que llegue al controller.