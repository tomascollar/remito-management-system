import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { registrarEvento } from '../security/eventosSeguridad';


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

// Verifica el token JWT de la cabecera Authorization y carga req.usuario.
// Cada rechazo queda en el registro de eventos de seguridad (auditoría).
const verificarTokenBase = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      registrarEvento('token_invalido', {
        ip: req.ip,
        detalle: `Petición sin token (${req.method} ${req.originalUrl})`,
      });
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
    // Se distingue el token VENCIDO (la sesión terminó) del token inválido (firma falsa, manipulado, mal formado)
    if (error instanceof jwt.TokenExpiredError) {
      registrarEvento('token_expirado', {
        ip: req.ip,
        detalle: `Token vencido el ${error.expiredAt.toISOString()} (${req.method} ${req.originalUrl})`,
      });
      res.status(401).json({ message: 'Token expirado. Iniciá sesión de nuevo.' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      registrarEvento('token_invalido', {
        ip: req.ip,
        detalle: `${error.message} (${req.method} ${req.originalUrl})`,
      });
    }
    res.status(401).json({ message: 'Token inválido' });
  }
};

// Se marca la función para que el Laboratorio pueda leer qué rutas exigen sesión (matriz de permisos)
export const verificarToken = Object.assign(verificarTokenBase, { requiereLogin: true as const });

// Permite el paso solo a los roles indicados; si no, responde 403 y deja registro del intento
export const verificarRol = (...rolesPermitidos: string[]) => {
  const verificar = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      registrarEvento('acceso_denegado', {
        ip: req.ip,
        usuario: req.usuario.id,
        detalle: `Rol "${req.usuario.rol}" intentó ${req.method} ${req.originalUrl} (requiere: ${rolesPermitidos.join(', ')})`,
      });
      res.status(403).json({ message: 'No tienes permisos para esta acción' });
      return;
    }

    next();
  };

  // Se marca la función con los roles que admite (lo lee la matriz de permisos del Laboratorio)
  return Object.assign(verificar, { rolesPermitidos });
};