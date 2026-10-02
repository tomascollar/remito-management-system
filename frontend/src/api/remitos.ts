import { api } from './client';
import type { AgregarItemInput, Remito } from '../types/remito';

export interface FiltroRemitos {
  estado?: 'abierto' | 'cerrado';
  desde?: string; // ISO: solo remitos desde esa fecha
}

export async function listRemitos(filtro: FiltroRemitos = {}) {
  const params: Record<string, string> = {};
  if (filtro.estado) params.estado = filtro.estado;
  if (filtro.desde) params.fecha_desde = filtro.desde;
  const { data } = await api.get<Remito[]>('/remitos', { params });
  return data;
}

export async function getRemito(id: string) {
  const { data } = await api.get<Remito>(`/remitos/${id}`);
  return data;
}

/** Crea un remito vacío, solo con el cliente. Los productos se agregan después. */
export async function crearRemito(nombre_cliente: string) {
  const { data } = await api.post<{ remito: Remito }>('/remitos', { nombre_cliente });
  return data.remito;
}

/** Agrega un ítem. Si es por bulto descuenta stock; por unidad no lo toca. Devuelve el remito actualizado. */
export async function agregarItem(remitoId: string, input: AgregarItemInput) {
  const { data } = await api.post<{ remito: Remito }>(`/remitos/${remitoId}/items`, input);
  return data.remito;
}

/** Quita un ítem y devuelve al stock los bultos que había consumido. */
export async function quitarItem(remitoId: string, itemId: string) {
  const { data } = await api.delete<{ remito: Remito }>(`/remitos/${remitoId}/items/${itemId}`);
  return data.remito;
}

export async function cerrarRemito(id: string) {
  const { data } = await api.patch<{ remito: Remito }>(`/remitos/${id}/cerrar`);
  return data.remito;
}

export async function reabrirRemito(id: string) {
  const { data } = await api.patch<{ remito: Remito }>(`/remitos/${id}/reabrir`);
  return data.remito;
}

/** Cambia la cantidad de un ítem (mantiene su precio). Ajusta el stock si es por bulto. */
export async function modificarCantidadItem(remitoId: string, itemId: string, cantidad: number) {
  const { data } = await api.patch<{ remito: Remito }>(`/remitos/${remitoId}/items/${itemId}`, { cantidad });
  return data.remito;
}
