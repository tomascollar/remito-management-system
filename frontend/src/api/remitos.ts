import { api } from './client';
import type { AgregarAjusteInput, AgregarItemInput, RegistrarEntregaInput, Remito, RemitoResumen } from '../types/remito';

export interface FiltroRemitos {
  estado?: 'abierto' | 'cerrado';
  desde?: string; // ISO: solo remitos desde esa fecha
  vendedor?: string; // id de usuario: solo los remitos de ese vendedor
  q?: string; // texto: busca por nombre de cliente o número de remito
  pagina?: number; // empieza en 1
  limite?: number;
}

/** Una página del listado, con el total para saber si quedan más por cargar. */
export interface PaginaRemitos {
  remitos: RemitoResumen[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

/** Lista remitos de a páginas (los más nuevos primero). Los filtros se aplican en el servidor. */
export async function listRemitos(filtro: FiltroRemitos = {}) {
  const params: Record<string, string | number> = {};
  if (filtro.estado) params.estado = filtro.estado;
  if (filtro.desde) params.fecha_desde = filtro.desde;
  if (filtro.vendedor) params.vendedor = filtro.vendedor;
  if (filtro.q) params.q = filtro.q;
  if (filtro.pagina) params.pagina = filtro.pagina;
  if (filtro.limite) params.limite = filtro.limite;
  const { data } = await api.get<PaginaRemitos>('/remitos', { params });
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

/** Agrega un ajuste (saldo anterior, descuento…). Solo con el remito abierto. */
export async function agregarAjuste(remitoId: string, input: AgregarAjusteInput) {
  const { data } = await api.post<{ remito: Remito }>(`/remitos/${remitoId}/ajustes`, input);
  return data.remito;
}

export async function quitarAjuste(remitoId: string, ajusteId: string) {
  const { data } = await api.delete<{ remito: Remito }>(`/remitos/${remitoId}/ajustes/${ajusteId}`);
  return data.remito;
}

/** Registra un pago a cuenta. Se permite también con el remito cerrado; no puede superar el saldo. */
export async function registrarEntrega(remitoId: string, input: RegistrarEntregaInput) {
  const { data } = await api.post<{ remito: Remito }>(`/remitos/${remitoId}/entregas`, input);
  return data.remito;
}

/** Anula una entrega cargada por error (queda el rastro, no se borra). */
export async function anularEntrega(remitoId: string, entregaId: string) {
  const { data } = await api.patch<{ remito: Remito }>(`/remitos/${remitoId}/entregas/${entregaId}/anular`);
  return data.remito;
}
