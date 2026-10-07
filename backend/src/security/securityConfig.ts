/**
 * Parámetros de seguridad ajustables en tiempo de ejecución (para el Laboratorio de seguridad).
 *
 * - Viven en memoria: al reiniciar el servidor vuelven a los valores por defecto.
 * - Solo se pueden modificar si el laboratorio está activo (SECURITY_LAB=true), porque las
 *   rutas que los cambian solo se montan en ese caso. En producción deben quedar en los
 *   valores por defecto.
 * - Cada valor tiene un rango permitido, así ni una demostración puede dejar la API sin
 *   límites ni inutilizarla.
 */

export interface ConfigSeguridad {
  loginMax: number; // intentos de login FALLIDOS permitidos por IP en la ventana
  loginVentanaSeg: number; // duración de esa ventana, en segundos
  generalMax: number; // peticiones totales permitidas por IP en la ventana
  generalVentanaSeg: number;
  jwtDuracionSeg: number; // validez de los tokens que se emiten al iniciar sesión, en segundos
}

/** [mínimo, máximo] aceptados para cada parámetro. */
export const LIMITES: Record<keyof ConfigSeguridad, readonly [number, number]> = {
  loginMax: [1, 1000],
  loginVentanaSeg: [10, 3600],
  generalMax: [1, 100000],
  generalVentanaSeg: [10, 3600],
  jwtDuracionSeg: [30, 86400],
};

/** Rango del costo de bcrypt que se puede medir en el laboratorio (cada +1 duplica el tiempo). */
export const COSTO_BCRYPT: readonly [number, number] = [4, 14];

/** El laboratorio solo existe si se activa explícitamente por variable de entorno. */
export const laboratorioActivo = (): boolean => process.env.SECURITY_LAB === 'true';

/** Valores de producción: los que rigen siempre que no se toque nada desde el laboratorio. */
export const valoresPorDefecto = (): ConfigSeguridad => ({
  loginMax: 5,
  loginVentanaSeg: 15 * 60,
  generalMax: process.env.NODE_ENV === 'production' ? 1000 : 10000,
  generalVentanaSeg: 15 * 60,
  jwtDuracionSeg: 8 * 60 * 60,
});

let actual: ConfigSeguridad = valoresPorDefecto();

/** Copia de la configuración vigente. */
export const getConfig = (): ConfigSeguridad => ({ ...actual });

/**
 * Cambia uno o más parámetros. Lanza RangeError si algún valor no es un entero dentro de su
 * rango (defensa en profundidad: la ruta ya valida, pero este módulo no confía en nadie).
 */
export const setConfig = (cambios: Partial<ConfigSeguridad>): ConfigSeguridad => {
  const nueva = { ...actual };
  for (const clave of Object.keys(cambios) as (keyof ConfigSeguridad)[]) {
    const valor = cambios[clave];
    if (valor === undefined) continue;
    const limites = LIMITES[clave];
    if (!limites) throw new RangeError(`Parámetro desconocido: ${clave}`);
    const [min, max] = limites;
    if (!Number.isInteger(valor) || valor < min || valor > max) {
      throw new RangeError(`${clave} debe ser un entero entre ${min} y ${max}`);
    }
    nueva[clave] = valor;
  }
  actual = nueva;
  return getConfig();
};

/** Vuelve a los valores por defecto. */
export const restaurarConfig = (): ConfigSeguridad => {
  actual = valoresPorDefecto();
  return getConfig();
};

/** Describe una duración en lenguaje natural: 900 -> "15 minutos", 90 -> "1 min 30 s". */
export const describirDuracion = (seg: number): string => {
  if (seg < 60) return `${seg} segundos`;
  const min = Math.floor(seg / 60);
  const resto = seg % 60;
  if (seg < 3600) return resto ? `${min} min ${resto} s` : `${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const horas = Math.floor(seg / 3600);
  const minRest = Math.floor((seg % 3600) / 60);
  return minRest ? `${horas} h ${minRest} min` : `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
};
