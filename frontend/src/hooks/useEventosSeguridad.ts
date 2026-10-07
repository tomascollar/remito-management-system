import { useCallback, useEffect, useRef, useState } from 'react';
import { borrarEventos, listEventos } from '../api/laboratorio';
import type { EventoSeguridad } from '../types/laboratorio';

const MAXIMO_EN_PANTALLA = 300;
const CADA_MS = 2000;

/**
 * Registro de eventos de seguridad en vivo: consulta al servidor cada 2 s, pidiendo solo
 * los eventos nuevos (desde el último id recibido). `activo` en false lo pausa.
 */
export function useEventosSeguridad(activo: boolean) {
  const [eventos, setEventos] = useState<EventoSeguridad[]>([]);
  const ultimoId = useRef(0);

  useEffect(() => {
    if (!activo) return;
    let cancelado = false;

    const consultar = async () => {
      try {
        const nuevos = await listEventos(ultimoId.current);
        if (cancelado || nuevos.length === 0) return;
        ultimoId.current = Math.max(...nuevos.map((e) => e.id));
        setEventos((prev) => [...nuevos, ...prev].slice(0, MAXIMO_EN_PANTALLA));
      } catch {
        // Un fallo puntual de red no corta el seguimiento: se reintenta en la próxima vuelta
      }
    };

    void consultar();
    const timer = setInterval(consultar, CADA_MS);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, [activo]);

  /** Vacía el registro del servidor y la lista en pantalla. */
  const vaciar = useCallback(async () => {
    await borrarEventos();
    ultimoId.current = 0;
    setEventos([]);
  }, []);

  return { eventos, vaciar };
}
