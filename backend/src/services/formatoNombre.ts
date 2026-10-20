/**
 * Formato de los nombres de cliente: sin importar cómo se escriba, se guarda con la primera
 * letra de cada palabra en mayúscula y el resto en minúscula ("CARLOS", "carlos" y "cARLOS" → "Carlos").
 *
 * - Se quitan los espacios de los bordes y se juntan los repetidos ("juan   perez" → "Juan Perez").
 * - Cada palabra se capitaliza, también después de guion, apóstrofo o paréntesis ("ana-maría" → "Ana-María", "o'brien" → "O'Brien", "pedro (mercado)" → "Pedro (Mercado)").
 * - Respeta tildes y la ñ; los números y símbolos quedan como están.
 * - Es idempotente: formatear un nombre ya formateado no lo cambia.
 *
 * Limitación conocida: no puede distinguir siglas ("SRL" queda "Srl") ni apellidos con mayúscula
 * interna ("McDonald" queda "Mcdonald"). Para un nombre de cliente en un comprobante interno es aceptable.
 */
export const formatearNombre = (texto: string): string =>
  texto
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-AR')
    .replace(/(^|[\s\-'’(])(\p{L})/gu, (_, separador: string, letra: string) => separador + letra.toLocaleUpperCase('es-AR'));
