import { Request , Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

//Ahora extendemos el tipo Request para incluir el usuario
interface AuthRequest extends Request{
    usuario?: {
        id: string;
        rol: string;
    };
}

// Middleware para verificar token JWT
export const verificarToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    // Obtener token del header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ message: 'Acceso denegado. No hay token.' });
      return;
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key') as {
      id: string;
      rol: string;
    };

    // Agregar usuario al request
    req.usuario = decoded;
    next(); // Continuar al siguiente middleware o controller
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
};

// Middleware para verificar roles específicos
export const verificarRol = (...rolesPermitidos: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      res.status(403).json({ message: 'No tienes permisos para esta acción' });
      return;
    }

    next();
  };
};

    
