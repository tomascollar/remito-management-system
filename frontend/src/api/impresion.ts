import { api } from './client';

/** Cómo va un trabajo de impresión (ver el ciclo de vida en el backend: models/TrabajoImpresion.ts). */
export type EstadoTrabajo = 'pendiente' | 'imprimiendo' | 'impreso' | 'error' | 'vencido';

export interface TrabajoImpresion {
  id: string;
  estado: EstadoTrabajo;
  error?: string;
}

/** ¿Está conectado el equipo del puesto que maneja la impresora? */
export async function getEstadoImpresion() {
  const { data } = await api.get<{ agente_conectado: boolean; ultimo_contacto: string | null }>('/impresion/estado');
  return data;
}

/**
 * Deja un ticket en la cola de impresión. `datos` es la imagen en blanco y negro (ver lib/pdf/raster.ts).
 * Si no hay impresora conectada el servidor responde 503 (y no encola nada).
 */
export async function enviarTicket(ticket: { ancho: number; alto: number; datos: string }, remitoId?: string) {
  const { data } = await api.post<TrabajoImpresion>('/impresion/trabajos', { ...ticket, remito: remitoId });
  return data;
}

export async function getTrabajo(id: string) {
  const { data } = await api.get<TrabajoImpresion>(`/impresion/trabajos/${id}`);
  return data;
}
