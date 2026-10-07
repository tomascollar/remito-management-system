import { useCallback, useEffect, useState } from 'react';
import { listMovimientos, type FiltroMovimientos } from '../api/stock';
import { getErrorMessage } from '../lib/errors';
import { inicioDeHoy, inicioHaceDias } from '../lib/fechas';
import type { MovimientoStock, TipoMovimiento } from '../types/stock';

export type Periodo = 'hoy' | '7d' | 'todo';

interface Opciones {
  tipo?: TipoMovimiento;
  producto?: string;
  periodo?: Periodo;
}

/** Lo ya cargado para una combinación de filtros (`clave`). */
interface Cargado {
  clave: string;
  movimientos: MovimientoStock[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

/** Arma el filtro de la API. La fecha se calcula al pedir (no al renderizar). */
const construirFiltro = ({ tipo, producto, periodo }: Opciones, pagina: number): FiltroMovimientos => ({
  tipo,
  producto,
  desde: periodo === 'hoy' ? inicioDeHoy() : periodo === '7d' ? inicioHaceDias(6) : undefined,
  pagina,
});

/** Agrega las filas nuevas sin repetir ninguna (si se registró algo entre páginas, una fila puede venir dos veces). */
const unir = (actuales: MovimientoStock[], nuevas: MovimientoStock[]) => {
  const vistos = new Set(actuales.map((m) => m._id));
  return [...actuales, ...nuevas.filter((m) => !vistos.has(m._id))];
};

/**
 * Historial de movimientos de stock, paginado y filtrado en el servidor.
 * Funciona igual que `useRemitos`: al cambiar un filtro se pide la primera página (mientras
 * llega se sigue mostrando la anterior), `cargarMas()` suma la siguiente y `reload()` recarga.
 */
export function useMovimientos({ tipo, producto, periodo = 'todo' }: Opciones = {}) {
  const [version, setVersion] = useState(0);
  const [datos, setDatos] = useState<Cargado | null>(null);
  const [fallo, setFallo] = useState<{ clave: string; mensaje: string } | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState<string | null>(null);

  const clave = [tipo ?? '', producto ?? '', periodo, version].join('|');

  useEffect(() => {
    let cancelado = false; // si los filtros cambian antes de que llegue la respuesta, se descarta
    listMovimientos(construirFiltro({ tipo, producto, periodo }, 1))
      .then((r) => {
        if (cancelado) return;
        setDatos({ clave, movimientos: r.movimientos, total: r.total, pagina: 1, totalPaginas: r.totalPaginas });
        setFallo(null);
        setErrorMas(null);
      })
      .catch((err) => {
        if (!cancelado) setFallo({ clave, mensaje: getErrorMessage(err, 'No se pudo cargar el historial') });
      });
    return () => {
      cancelado = true;
    };
  }, [clave, tipo, producto, periodo]);

  const actual = datos?.clave === clave;
  const error = fallo?.clave === clave ? fallo.mensaje : null;

  /** Trae la página siguiente y la suma a la lista (si todavía corresponde a los filtros actuales). */
  const cargarMas = useCallback(async () => {
    if (!datos || !actual || cargandoMas || datos.pagina >= datos.totalPaginas) return;
    setCargandoMas(true);
    setErrorMas(null);
    try {
      const r = await listMovimientos(construirFiltro({ tipo, producto, periodo }, datos.pagina + 1));
      setDatos((prev) =>
        prev && prev.clave === datos.clave
          ? { ...prev, movimientos: unir(prev.movimientos, r.movimientos), total: r.total, pagina: r.pagina, totalPaginas: r.totalPaginas }
          : prev,
      );
    } catch (err) {
      setErrorMas(getErrorMessage(err, 'No se pudieron cargar más movimientos'));
    } finally {
      setCargandoMas(false);
    }
  }, [datos, actual, cargandoMas, tipo, producto, periodo]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    movimientos: datos?.movimientos ?? [],
    total: datos?.total ?? 0,
    loading: datos === null && error === null,
    actualizando: !actual && error === null && datos !== null,
    error,
    hayMas: datos !== null && datos.pagina < datos.totalPaginas,
    cargandoMas,
    errorMas,
    cargarMas,
    reload,
  };
}
