import type { Producto } from './product';
import type { StockVigente } from './stock';

export type UnidadVenta = 'bulto' | 'unidad';

/** Una línea del remito. El precio queda congelado al momento de la venta. */
export interface RemitoItem {
  _id: string;
  producto: string;
  nombre_producto: string;
  cantidad: number;
  unidad_venta: UnidadVenta;
  bultos_consumidos: number; // 0 en ventas por unidad (no descuentan stock)
  precio_unitario: number;
  subtotal: number;
}

export interface VendedorRef {
  _id: string;
  nombre: string;
  email: string;
}

export interface Remito {
  _id: string;
  numero_remito: number;
  fecha: string;
  nombre_cliente: string;
  items: RemitoItem[];
  total: number;
  // GET devuelve el vendedor poblado; las respuestas de crear/agregar/quitar solo el id
  vendedor: string | VendedorRef;
  estado: 'abierto' | 'cerrado';
  createdAt: string;
}

export interface AgregarItemInput {
  producto: string;
  cantidad: number;
  unidad_venta: UnidadVenta;
}

/** Producto activo que ya tiene stock vigente cargado: es lo único que se puede vender. */
export interface FilaVenta {
  producto: Producto;
  stock: StockVigente;
}
