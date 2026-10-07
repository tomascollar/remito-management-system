import type { Producto } from './product';

// Datos del producto que el backend incluye al hacer populate del stock
export interface StockProductoRef {
  _id: string;
  nombre: string;
  categoria?: string;
  unidad_stock: string;
  permite_venta_fraccionada: boolean;
}

// Stock vigente de un producto: lo que queda hoy y a qué precio se vende
export interface StockVigente {
  _id: string;
  producto: StockProductoRef | null; // null si el producto fue eliminado
  cantidad_bultos_inicial: number;
  cantidad_bultos_actual: number;
  precio_bulto: number;
  precio_unidad?: number;
  fecha: string;
}

// Una fila de la pantalla: cada producto activo, con su stock vigente si ya se cargó
export interface FilaStock {
  producto: Producto;
  stock: StockVigente | null;
}

export interface NuevoStockInput {
  producto: string;
  cantidad_bultos_inicial: number;
  precio_bulto: number;
  precio_unidad?: number;
}

export interface PrecioInput {
  precio_bulto?: number;
  precio_unidad?: number;
}

// ---- Historial de movimientos de stock (auditoría) ----

export type TipoMovimiento = 'stock_inicial' | 'entrada_adicional' | 'ajuste' | 'venta' | 'devolucion';

// Un movimiento del historial. Los datos relacionados vienen resueltos (populate);
// pueden ser null si el producto, usuario o remito ya no existe.
export interface MovimientoStock {
  _id: string;
  fecha: string;
  tipo: TipoMovimiento;
  cantidad_bultos: number; // negativo = salieron bultos, positivo = entraron
  producto: { _id: string; nombre: string; categoria?: string } | null;
  usuario: { _id: string; nombre: string; email: string } | null;
  remito?: { _id: string; numero_remito: number; nombre_cliente: string } | null;
  observaciones?: string;
}
