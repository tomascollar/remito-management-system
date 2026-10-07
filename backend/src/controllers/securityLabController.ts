import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { reiniciarLimitadores } from '../middleware/rateLimiter';
import { limpiarEventos, listarEventos, registrarEvento, type TipoEvento } from '../security/eventosSeguridad';
import { calcularMatriz, type Montaje } from '../security/matrizPermisos';
import {
  COSTO_BCRYPT,
  LIMITES,
  getConfig,
  restaurarConfig,
  setConfig,
  valoresPorDefecto,
  type ConfigSeguridad,
} from '../security/securityConfig';

/**
 * Laboratorio de seguridad: endpoints para DEMOSTRAR las medidas de seguridad en vivo.
 * Solo existen si SECURITY_LAB=true y solo los puede usar un superadmin (ver securityLabRoutes).
 */

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado en las variables de entorno');
}

const CLAVES: (keyof ConfigSeguridad)[] = ['loginMax', 'loginVentanaSeg', 'generalMax', 'generalVentanaSeg', 'jwtDuracionSeg'];
const quien = (req: Request) => (req as Request & { usuario?: { id: string } }).usuario?.id;

// Estado actual: configuración vigente, valores por defecto y rangos permitidos
export const getEstado = (_req: Request, res: Response): void => {
  res.json({
    config: getConfig(),
    porDefecto: valoresPorDefecto(),
    limites: LIMITES,
    costoBcrypt: COSTO_BCRYPT,
    ahora: Date.now(), // hora del servidor, para que el navegador calcule cuenta regresivas sin depender de su reloj
  });
};

// Cambia parámetros. Se reconstruyen los limitadores, así que los contadores arrancan de cero.
export const actualizarConfig = (req: Request, res: Response): void => {
  try {
    const antes = getConfig();
    const cambios: Partial<ConfigSeguridad> = {};
    for (const clave of CLAVES) if (req.body[clave] !== undefined) cambios[clave] = req.body[clave];

    const despues = setConfig(cambios);
    reiniciarLimitadores();

    const detalle = CLAVES.filter((c) => antes[c] !== despues[c]).map((c) => `${c}: ${antes[c]} → ${despues[c]}`).join(', ');
    registrarEvento('config_cambiada', { usuario: quien(req), ip: req.ip, detalle: detalle || 'Sin cambios' });
    res.json({ config: despues });
  } catch (error) {
    if (error instanceof RangeError) {
      res.status(400).json({ message: error.message });
      return;
    }
    console.error('Error en actualizarConfig:', error);
    res.status(500).json({ message: 'Error al actualizar la configuración' });
  }
};

export const restaurar = (req: Request, res: Response): void => {
  const config = restaurarConfig();
  reiniciarLimitadores();
  registrarEvento('config_cambiada', { usuario: quien(req), ip: req.ip, detalle: 'Se restauraron los valores por defecto' });
  res.json({ config });
};

// Pone en cero los contadores de intentos sin cambiar la configuración (para repetir una demostración)
export const reiniciarContadores = (req: Request, res: Response): void => {
  reiniciarLimitadores();
  registrarEvento('contadores_reiniciados', { usuario: quien(req), ip: req.ip, detalle: 'Contadores de intentos en cero' });
  res.json({ message: 'Contadores reiniciados' });
};

// Emite un token de prueba para el usuario actual con la duración pedida (por defecto, la configurada).
// No toca la sesión real: sirve para ver cómo el servidor rechaza el token cuando vence.
export const emitirTokenDemo = (req: Request, res: Response): void => {
  const usuario = (req as Request & { usuario?: { id: string; rol: string } }).usuario;
  const duracionSeg: number = req.body.duracionSeg ?? getConfig().jwtDuracionSeg;
  const token = jwt.sign({ id: usuario?.id, rol: usuario?.rol }, JWT_SECRET, { expiresIn: duracionSeg });
  const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
  res.json({ token, emitidoEn: iat * 1000, venceEn: exp * 1000, duracionSeg, ahora: Date.now() });
};

// Mide cuánto tarda bcrypt en hashear con un costo dado. Cada +1 de costo duplica el tiempo,
// que es justamente lo que encarece un ataque de fuerza bruta contra los hashes.
export const medirBcrypt = async (req: Request, res: Response): Promise<void> => {
  try {
    const costo: number = req.body.costo;
    const inicio = process.hrtime.bigint();
    const hash = await bcrypt.hash('contraseña-de-demostracion', costo);
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    res.json({ costo, ms: Math.round(ms), hash });
  } catch (error) {
    console.error('Error en medirBcrypt:', error);
    res.status(500).json({ message: 'Error al medir bcrypt' });
  }
};

export const getEventos = (req: Request, res: Response): void => {
  const eventos = listarEventos({
    desdeId: Number(req.query.desde_id) || 0,
    tipo: req.query.tipo as TipoEvento | undefined,
  });
  res.json({ eventos });
};

export const borrarEventos = (_req: Request, res: Response): void => {
  limpiarEventos();
  res.json({ message: 'Registro vaciado' });
};

/** Arma el controlador de la matriz con la lista de routers montados (se pasa desde las rutas). */
export const crearGetPermisos = (montajes: Montaje[]) => (_req: Request, res: Response): void => {
  res.json({ roles: ['superadmin', 'administrador', 'vendedor'], rutas: calcularMatriz(montajes) });
};
