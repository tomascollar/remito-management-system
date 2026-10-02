import { api } from './client';
import type { Producto, ProductoInput } from '../types/product';

/** Trae todos los productos (activos e inactivos); el filtrado se hace en el cliente. */
export async function listProductos() {
  const { data } = await api.get<Producto[]>('/products');
  return data;
}

export async function createProducto(input: ProductoInput) {
  await api.post('/products', input);
}

export async function updateProducto(id: string, input: ProductoInput) {
  await api.put(`/products/${id}`, input);
}

/** Baja lógica: desactivar/reactivar (el producto no se borra, se conserva su historial). */
export async function setProductoActivo(id: string, activo: boolean) {
  await api.patch(`/products/${id}/${activo ? 'reactivar' : 'desactivar'}`);
}