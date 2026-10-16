/**
 * ¿Hay un agente de impresión conectado?
 *
 * El agente consulta la cola cada pocos segundos; cada consulta deja acá la hora del último
 * contacto. Si pasó más de MARGEN_MS sin noticias, se lo considera desconectado y la app avisa
 * al usuario ANTES de encolar un ticket que nadie iba a imprimir.
 *
 * Vive en memoria: alcanza porque hay una sola instancia del servidor. Si se reinicia, el estado
 * se recupera solo en unos segundos (con la próxima consulta del agente).
 */
export const MARGEN_MS = 20_000;

let ultimoContacto: number | null = null;

export const registrarContactoAgente = (ahora: number = Date.now()): void => {
  ultimoContacto = ahora;
};

export const agenteConectado = (ahora: number = Date.now()): boolean => ultimoContacto !== null && ahora - ultimoContacto <= MARGEN_MS;

export const fechaUltimoContacto = (): Date | null => (ultimoContacto === null ? null : new Date(ultimoContacto));

/** Solo para las pruebas. */
export const reiniciarEstadoAgente = (): void => {
  ultimoContacto = null;
};
