import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

interface AuthRequest extends Request {
  usuario?: {
    id: string;
    rol: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado en las variables de entorno');
}

export const verificarToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ message: 'Acceso denegado. No hay token.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      rol: string;
    };

    const usuario = await User.findById(decoded.id).select('activo rol');
    if (!usuario) {
      res.status(401).json({ message: 'Usuario no encontrado' });
      return;
    }
    if (!usuario.activo) {
      res.status(401).json({ message: 'Usuario inactivo. Contactá a un administrador.' });
      return;
    }

    req.usuario = { id: decoded.id, rol: usuario.rol };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
};

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