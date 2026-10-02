// Los productos usan el _id de Mongo tal como llega de la API
export interface Producto {
  _id: string;
  nombre: string;
  categoria?: string;
  unidad_stock: string;
  cantidad_por_bulto?: number;
  permite_venta_fraccionada: boolean;
  activo: boolean;
  createdAt: string;
}

// Lo que se envía al crear o editar
export interface ProductoInput {
  nombre: string;
  categoria: string;
  unidad_stock?: string;
  permite_venta_fraccionada: boolean;
    cantidad_por_bulto: number | null; // null = sin dato (o borrarlo al editar)
}