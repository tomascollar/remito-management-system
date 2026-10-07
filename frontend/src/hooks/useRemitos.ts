import { useCallback, useEffect, useState } from 'react';
import { listRemitos, type FiltroRemitos } from '../api/remitos';
import { getErrorMessage } from '../lib/errors';
import { inicioDeHoy } from '../lib/fechas';
import type { RemitoResumen } from '../types/remito';

interface Opciones {
  estado?: 'abierto' | 'cerrado';
  soloHoy?: boolean;
  vendedor?: string; // id: solo los remitos de ese vendedor
  q?: string; // búsqueda por cliente o número
}

/** Lo ya cargado para una combinación de filtros (`clave`). */
interface Cargado {
  clave: string;
  remitos: RemitoResumen[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

/** Arma el filtro de la API. La fecha de "hoy" se calcula al pedir (no al renderizar). */
const construirFiltro = ({ estado, soloHoy, vendedor, q }: Opciones, pagina: number): FiltroRemitos => ({
  estado,
  desde: soloHoy ? inicioDeHoy() : undefined,
  vendedor,
  q: q || undefined,
  pagina,
});

/** Agrega las filas nuevas sin repetir ninguna (si se creó un remito entre páginas, una fila puede venir dos veces). */
const unir = (actuales: RemitoResumen[], nuevas: RemitoResumen[]) => {
  const vistos = new Set(actuales.map((r) => r._id));
  return [...actuales, ...nuevas.filter((r) => !vistos.has(r._id))];
};

/**
 * Lista de remitos paginada y con filtros que se resuelven en el servidor.
 *
 * - Al cambiar un filtro se vuelve a pedir la primera página; mientras llega, se sigue
 *   mostrando la lista anterior (`actualizando`), para que no parpadee al escribir en el buscador.
 * - `cargarMas()` trae la página siguiente y la agrega al final.
 * - `reload()` vuelve a pedir desde la primera página.
 * - `loading` es true solo cuando todavía no hay nada para mostrar.
 */
export function useRemitos({ estado, soloHoy, vendedor, q }: Opciones = {}) {
  const [version, setVersion] = useState(0);
  const [datos, setDatos] = useState<Cargado | null>(null);
  const [fallo, setFallo] = useState<{ clave: string; mensaje: string } | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState<string | null>(null);

  // Identifica la combinación actual de filtros: si cambia, lo cargado queda desactualizado
  const clave = [estado ?? '', soloHoy ? 'hoy' : '', vendedor ?? '', q ?? '', version].join('|');

  useEffect(() => {
    let cancelado = false; // si los filtros cambian antes de que llegue la respuesta, se descarta
    listRemitos(construirFiltro({ estado, soloHoy, vendedor, q }, 1))
      .then((r) => {
        if (cancelado) return;
        setDatos({ clave, remitos: r.remitos, total: r.total, pagina: 1, totalPaginas: r.totalPaginas });
        setFallo(null);
        setErrorMas(null);
      })
      .catch((err) => {
        if (!cancelado) setFallo({ clave, mensaje: getErrorMessage(err, 'No se pudieron cargar los remitos') });
      });
    return () => {
      cancelado = true;
    };
  }, [clave, estado, soloHoy, vendedor, q]);

  const actual = datos?.clave === clave;
  const error = fallo?.clave === clave ? fallo.mensaje : null;

  /** Trae la página siguiente y la suma a la lista (si todavía corresponde a los filtros actuales). */
  const cargarMas = useCallback(async () => {
    if (!datos || !actual || cargandoMas || datos.pagina >= datos.totalPaginas) return;
    setCargandoMas(true);
    setErrorMas(null);
    try {
      const r = await listRemitos(construirFiltro({ estado, soloHoy, vendedor, q }, datos.pagina + 1));
      setDatos((prev) =>
        prev && prev.clave === datos.clave
          ? { ...prev, remitos: unir(prev.remitos, r.remitos), total: r.total, pagina: r.pagina, totalPaginas: r.totalPaginas }
          : prev,
      );
    } catch (err) {
      setErrorMas(getErrorMessage(err, 'No se pudieron cargar más remitos'));
    } finally {
      setCargandoMas(false);
    }
  }, [datos, actual, cargandoMas, estado, soloHoy, vendedor, q]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    remitos: datos?.remitos ?? [],
    total: datos?.total ?? 0,
    loading: datos === null && error === null, // todavía no hay nada para mostrar
    actualizando: !actual && error === null && datos !== null, // hay lista vieja y se está pidiendo la nueva
    error,
    hayMas: datos !== null && datos.pagina < datos.totalPaginas,
    cargandoMas,
    errorMas,
    cargarMas,
    reload,
  };
}
