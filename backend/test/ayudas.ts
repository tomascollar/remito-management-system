/**
 * Utilidades compartidas por los tests: emiten tokens y simulan al usuario en la base.
 */
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../src/models/User';

export type Rol = 'superadmin' | 'administrador' | 'vendedor';

/** Un id de Mongo válido cualquiera. */
export const nuevoId = (): string => new mongoose.Types.ObjectId().toString();

/** Token firmado con el secreto de la app, como el que emite el login. */
export const tokenDe = (id: string, rol: Rol, opciones: jwt.SignOptions = { expiresIn: '1h' }): string =>
  jwt.sign({ id, rol }, process.env.JWT_SECRET as string, opciones);

/**
 * Hace que el middleware de autenticación encuentre al usuario `id` en la "base".
 * Devuelve el token listo para usar en la cabecera Authorization.
 */
export const iniciarSesionComo = (rol: Rol, { activo = true } = {}): string => {
  const id = nuevoId();
  jest.spyOn(User, 'findById').mockImplementation((() => ({ select: async () => ({ activo, rol }) })) as any);
  return tokenDe(id, rol);
};

/** Cabecera Authorization con el token. */
export const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });
