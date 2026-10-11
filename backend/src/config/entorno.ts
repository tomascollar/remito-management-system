/**
 * Lectura y validación de las variables de entorno.
 *
 * Se ejecuta UNA vez al arrancar (al importar este módulo). Si falta algo importante o hay un
 * valor peligroso, el servidor NO arranca y explica qué corregir. Es mejor fallar al inicio, con
 * un mensaje claro, que quedar corriendo mal configurado (por ejemplo con un secreto débil).
 *
 * Importante: debe importarse DESPUÉS de cargar el .env (`import 'dotenv/config'`).
 */
import path from 'path';

export interface Entorno {
  produccion: boolean;
  puerto: number;
  /** Cantidad de proxies de confianza delante de la app (Render = 1). 0 = ninguno. */
  trustProxy: number | false;
  /** Orígenes que pueden llamar a la API desde otro dominio. Vacío = solo el mismo origen (lo normal). */
  corsOrigenes: string[];
  /** Carpeta del frontend compilado (vite build). */
  frontendDist: string;
}

/** Secretos de ejemplo que nunca deberían usarse de verdad. */
const SECRETOS_DE_EJEMPLO = ['cambiar', 'changeme', 'secret', 'secreto', 'password', 'tu_secreto', 'your_secret'];

export const cargarEntorno = (env: NodeJS.ProcessEnv = process.env): Entorno => {
  const problemas: string[] = [];
  const produccion = env.NODE_ENV === 'production';

  // --- Base de datos ---
  const uri = env.MONGODB_URI;
  if (!uri) problemas.push('MONGODB_URI no está definida.');
  else if (!/^mongodb(\+srv)?:\/\//.test(uri)) problemas.push('MONGODB_URI debe empezar con mongodb:// o mongodb+srv://');

  // --- Firma de los tokens ---
  const secreto = env.JWT_SECRET;
  if (!secreto) {
    problemas.push('JWT_SECRET no está definida.');
  } else if (produccion) {
    if (secreto.length < 32) problemas.push('JWT_SECRET es demasiado corta para producción (mínimo 32 caracteres).');
    if (SECRETOS_DE_EJEMPLO.some((s) => secreto.toLowerCase().includes(s))) {
      problemas.push('JWT_SECRET parece un valor de ejemplo. Generá una aleatoria (ver DESPLIEGUE.md).');
    }
  }

  // --- Puerto ---
  const puerto = env.PORT ? Number(env.PORT) : 5000;
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) problemas.push('PORT debe ser un número entre 1 y 65535.');

  // --- Proxy de confianza: sin esto, detrás de Render todas las peticiones parecen venir de la misma IP
  //     y el límite de intentos de login bloquearía a todos a la vez (o se podría falsear la IP). ---
  let trustProxy: number | false = produccion ? 1 : false;
  if (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== '') {
    const n = Number(env.TRUST_PROXY);
    if (env.TRUST_PROXY === 'false') trustProxy = false;
    else if (Number.isInteger(n) && n >= 0 && n <= 5) trustProxy = n === 0 ? false : n;
    else problemas.push('TRUST_PROXY debe ser un entero entre 0 y 5 (o "false").');
  }

  // --- CORS: por defecto cerrado. El frontend se sirve desde el mismo origen que la API. ---
  const corsOrigenes = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (corsOrigenes.some((o) => o === '*')) problemas.push('CORS_ORIGIN no puede ser "*": listá los orígenes permitidos.');

  if (problemas.length > 0) {
    throw new Error(`Configuración de entorno inválida:\n - ${problemas.join('\n - ')}`);
  }

  return {
    produccion,
    puerto,
    trustProxy,
    corsOrigenes,
    // Compilado: backend/dist/config → ../../../frontend/dist. En desarrollo (ts/tsx): backend/src/config → igual.
    frontendDist: env.FRONTEND_DIST ? path.resolve(env.FRONTEND_DIST) : path.resolve(__dirname, '../../../frontend/dist'),
  };
};

export const entorno: Entorno = cargarEntorno();
