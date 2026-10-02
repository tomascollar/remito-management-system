// Espejo de backend/src/constants/catalogos.ts: si cambiás uno, cambiá el otro.
export const UNIDADES_STOCK = ['Bulto', 'Cajón', 'Bolsa', 'Atado', 'Jaula', 'Malla', 'Bandeja'] as const;
export const CATEGORIAS = ['Verduras', 'Verduras de hoja', 'Frutas', 'Otros'] as const;

export const enCatalogo = (lista: readonly string[], valor: string) => lista.includes(valor);

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Empareja un valor viejo de texto libre con el catálogo ("cajon" -> "Cajón"),
 * para que al editar productos ya cargados el desplegable llegue preseleccionado.
 * Si no hay coincidencia devuelve '' y hay que elegir de nuevo.
 */
export const aCatalogo = (valor: string | undefined, lista: readonly string[]) =>
  lista.find((x) => normalizar(x) === normalizar(valor ?? '')) ?? '';