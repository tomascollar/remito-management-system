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
  bultos_consumidos: number; // bultos descontados del stock (decimal en ventas por unidad: 11 u. de 10 por bulto = 1,1)
  contenido_por_bulto?: number; // solo ventas por unidad: unidades por bulto con las que se calculó el descuento
  precio_unitario: number;
  precio_x_bulto?: boolean; // true si se vendió a P.UxB (precio de unidad por bulto)
  subtotal: number;
}

/** Línea sin producto ni stock: "saldo anterior", descuento, recargo. Positivo suma, negativo resta. */
export interface RemitoAjuste {
  _id: string;
  concepto: string;
  monto: number; // negativo = descuento (ej: vacíos devueltos)
  resaltado: boolean; // se dibuja destacado en el comprobante
}

/** Pago a cuenta. Si fue un error se anula (no se borra), por eso conserva quién y cuándo. */
export interface RemitoEntrega {
  _id: string;
  monto: number;
  fecha: string;
  usuario: string;
  nota?: string;
  anulada: boolean;
  anulada_por?: string;
  anulada_fecha?: string;
}

export type EstadoPago = 'pendiente' | 'parcial' | 'pagado';

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
  ajustes: RemitoAjuste[];
  entregas: RemitoEntrega[];
  total: number; // productos + ajustes
  entregado: number; // suma de las entregas no anuladas (lo calcula el servidor)
  saldo: number; // total - entregado; negativo = el cliente pagó de más
  // GET devuelve el vendedor poblado; las respuestas de crear/agregar/quitar solo el id
  vendedor: string | VendedorRef;
  estado: 'abierto' | 'cerrado';
  createdAt: string;
}

/**
 * Remito tal como lo devuelve el listado: sin el detalle de ítems (solo cuántos tiene).
 * El detalle completo se pide aparte con getRemito.
 */
export type RemitoResumen = Omit<Remito, 'items' | 'ajustes' | 'entregas'> & {
  cantidad_items: number;
  estado_pago: EstadoPago;
};

export interface AgregarAjusteInput {
  concepto: string;
  monto: number; // con signo, distinto de 0
  resaltado?: boolean;
}

export interface RegistrarEntregaInput {
  monto: number;
  nota?: string;
}

export interface AgregarItemInput {
  producto: string;
  cantidad: number;
  unidad_venta: UnidadVenta;
  precio_x_bulto?: boolean; // solo con unidad_venta 'unidad': usa el precio P.UxB
}

/** Producto activo que ya tiene stock vigente cargado: es lo único que se puede vender. */
export interface FilaVenta {
  producto: Producto;
  stock: StockVigente;
}
