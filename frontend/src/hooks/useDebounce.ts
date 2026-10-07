import { useEffect, useState } from 'react';

/**
 * Devuelve `valor` pero recién después de que dejó de cambiar durante `ms` milisegundos.
 * Sirve para el buscador: así se consulta al servidor al terminar de escribir, no en cada tecla.
 */
export function useDebounce<T>(valor: T, ms = 350): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}
