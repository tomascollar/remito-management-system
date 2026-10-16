/**
 * Lectura y validación de la configuración del agente (archivo .env o variables de entorno).
 * Si algo falta o es inseguro el agente NO arranca y dice qué corregir: mejor fallar al inicio,
 * con un mensaje claro, que quedar corriendo mal configurado.
 */
import fs from 'fs';

export type Corte = 'parcial' | 'total' | 'ninguno';

export interface Config {
  servidorUrl: string;
  token: string;
  impresoraHost: string;
  impresoraPuerto: number;
  intervaloMs: number;
  timeoutImpresoraMs: number;
  corte: Corte;
}

/** La clave del servidor tiene al menos 32 caracteres; una más corta no puede ser la correcta. */
export const LARGO_MINIMO_TOKEN = 32;

/**
 * Carga un archivo .env sin dependencias: líneas CLAVE=valor, ignorando vacías y comentarios (#).
 * No pisa las variables ya definidas en el entorno (así el entorno real siempre manda).
 */
export const cargarArchivoEnv = (ruta: string, env: NodeJS.ProcessEnv = process.env): void => {
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || m[1] in env) continue;
    env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2'); // quita comillas alrededor, si las hay
  }
};

const esLocal = (host: string) => /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(host);

export const cargarConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const problemas: string[] = [];

  // --- Servidor: se exige https (la clave viaja en cada consulta); http solo para pruebas en la propia PC ---
  let servidorUrl = (env.SERVIDOR_URL ?? '').trim().replace(/\/+$/, '');
  if (!servidorUrl) problemas.push('SERVIDOR_URL no está definida.');
  else {
    try {
      const u = new URL(servidorUrl);
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && esLocal(u.hostname))) {
        problemas.push('SERVIDOR_URL debe empezar con https:// (http solo se admite para localhost).');
      }
      servidorUrl = u.origin;
    } catch {
      problemas.push('SERVIDOR_URL no es una dirección válida.');
    }
  }

  const token = (env.AGENTE_TOKEN ?? '').trim();
  if (!token) problemas.push('AGENTE_TOKEN no está definida.');
  else if (token.length < LARGO_MINIMO_TOKEN) problemas.push(`AGENTE_TOKEN es demasiado corta (mínimo ${LARGO_MINIMO_TOKEN} caracteres). ¿Copiaste el valor completo de Render?`);

  const impresoraHost = (env.IMPRESORA_HOST ?? '').trim();
  if (!impresoraHost) problemas.push('IMPRESORA_HOST no está definida (la IP de la impresora).');
  else if (!/^[A-Za-z0-9.-]+$/.test(impresoraHost)) problemas.push('IMPRESORA_HOST solo puede ser una IP o un nombre de equipo.');

  const numero = (nombre: string, porDefecto: number, min: number, max: number): number => {
    const crudo = env[nombre];
    if (crudo === undefined || crudo === '') return porDefecto;
    const n = Number(crudo);
    if (!Number.isInteger(n) || n < min || n > max) {
      problemas.push(`${nombre} debe ser un número entero entre ${min} y ${max}.`);
      return porDefecto;
    }
    return n;
  };
  const impresoraPuerto = numero('IMPRESORA_PUERTO', 9100, 1, 65535);
  const intervaloMs = numero('INTERVALO_MS', 3000, 1000, 60000);
  const timeoutImpresoraMs = numero('TIMEOUT_IMPRESORA_MS', 8000, 1000, 60000);

  const corte = (env.CORTE ?? 'parcial').trim().toLowerCase();
  if (!['parcial', 'total', 'ninguno'].includes(corte)) problemas.push('CORTE debe ser parcial, total o ninguno.');

  if (problemas.length > 0) throw new Error(`Configuración inválida:\n - ${problemas.join('\n - ')}`);
  return { servidorUrl, token, impresoraHost, impresoraPuerto, intervaloMs, timeoutImpresoraMs, corte: corte as Corte };
};
