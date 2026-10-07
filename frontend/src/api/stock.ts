import { api } from './client';
import type { MovimientoStock, NuevoStockInput, PrecioInput, StockVigente, TipoMovimiento } from '../types/stock';

/** Stock vigente de todos los productos que tienen stock cargado. */
export async function listStock() {
  const { data } = await api.get<StockVigente[]>('/stock-diario');
  return data;
}

/**
 * Registra stock nuevo (llegó el camión). OJO: reemplaza el stock vigente del producto,
 * el anterior pasa a histórico. Para sumar mercadería sin reemplazar, usar agregarStock.
 */
export async function registrarStock(input: NuevoStockInput) {
  await api.post('/stock-diario', input);
}

/** Ingreso adicional: suma bultos al stock actual (y al inicial). */
export async function agregarStock(productoId: string, cantidad_bultos: number) {
  await api.patch(`/stock-diario/${productoId}/agregar`, { cantidad_bultos });
}

/** Cambia los precios del stock vigente. Los remitos ya generados conservan su precio. */
export async function actualizarPrecio(productoId: string, input: PrecioInput) {
  await api.patch(`/stock-diario/${productoId}/precio`, input);
}

/** Corrección manual: cantidad positiva suma, negativa resta. Queda registrada como movimiento. */
export async function ajustarStock(productoId: string, cantidad_bultos: number, observaciones?: string) {
  await api.patch(`/stock-diario/${productoId}/ajuste`, { cantidad_bultos, observaciones });
}

export interface FiltroMovimientos {
  tipo?: TipoMovimiento;
  producto?: string; // id de producto
  desde?: string; // ISO: solo movimientos desde esa fecha
  pagina?: number; // empieza en 1
  limite?: number;
}

/** Una página del historial, con el total para saber si quedan más por cargar. */
export interface PaginaMovimientos {
  movimientos: MovimientoStock[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

/** Historial de movimientos de stock (solo administración), los más nuevos primero. */
export async function listMovimientos(filtro: FiltroMovimientos = {}) {
  const params: Record<string, string | number> = {};
  if (filtro.tipo) params.tipo = filtro.tipo;
  if (filtro.producto) params.producto = filtro.producto;
  if (filtro.desde) params.fecha_desde = filtro.desde;
  if (filtro.pagina) params.pagina = filtro.pagina;
  if (filtro.limite) params.limite = filtro.limite;
  const { data } = await api.get<PaginaMovimientos>('/stock-diario/movimientos', { params });
  return data;
}
