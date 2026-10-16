import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Check, Download, Printer, Share2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { enviarTicket, getTrabajo } from '../../api/impresion';
import { getErrorMessage } from '../../lib/errors';
import { abrirParaImprimir, compartir, crearArchivos, descargar, type ArchivosRemito } from '../../lib/pdf/acciones';
import { ticketARaster, TicketMuyLargo } from '../../lib/pdf/raster';
import type { Remito } from '../../types/remito';

/** Cada cuánto se consulta si ya se imprimió, y cuántas veces como máximo (≈ 75 s) antes de rendirse. */
const CADA_MS = 1500;
const CONSULTAS_MAXIMAS = 50;
/** Cuántas consultas seguidas pueden fallar por la red antes de darlo por perdido. */
const FALLOS_TOLERADOS = 3;

/** Cómo va el pedido de imprimir. Mientras no sea "reposo" ni "error", el botón queda ocupado. */
type Impresion =
  | { fase: 'reposo' }
  | { fase: 'enviando' } // convirtiendo el ticket y subiéndolo
  | { fase: 'imprimiendo' } // en la cola: esperando que el equipo del puesto lo imprima
  | { fase: 'impreso' }
  | { fase: 'error'; mensaje: string };

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Botones para sacar el remito de la app: Compartir (imágenes PNG del remito por WhatsApp o mail,
 * porque algunos celulares no abren PDF), Descargar (el PDF A5) e Imprimir (ticket en la térmica).
 *
 * Imprimir NO abre el PDF: manda el ticket al servidor y el equipo del puesto que maneja la impresora
 * lo imprime (ver agente-impresion). Si no hay impresora conectada, o falla, se ofrece abrir el
 * ticket en PDF para imprimirlo desde otro equipo.
 *
 * Los archivos se generan por adelantado y se regeneran cada vez que cambia el remito. Así, cuando
 * se toca un botón el archivo ya está listo, algo necesario para que iOS permita compartir.
 */
export function RemitoAcciones({ remito }: { remito: Remito }) {
  const [archivos, setArchivos] = useState<ArchivosRemito | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [impresion, setImpresion] = useState<Impresion>({ fase: 'reposo' });
  const montado = useRef(true);
  const ocupado = useRef(false); // evita que un doble toque encole el ticket dos veces

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; }; // al salir de la pantalla se deja de consultar
  }, []);

  useEffect(() => {
    let cancelado = false;
    crearArchivos(remito)
      .then((a) => { if (!cancelado) setArchivos(a); })
      .catch(() => { if (!cancelado) setAviso('No se pudo preparar el PDF del remito'); });
    return () => { cancelado = true; };
  }, [remito]);

  const listo = archivos !== null;

  const onCompartir = async () => {
    if (!archivos) return;
    setAviso(null);
    try {
      await compartir(archivos);
    } catch {
      setAviso('No se pudo compartir el remito');
    }
  };

  /** Consulta cada tanto hasta que el trabajo termina (impreso, error o vencido). */
  const esperarResultado = async (id: string): Promise<Impresion> => {
    let fallos = 0;
    for (let i = 0; i < CONSULTAS_MAXIMAS && montado.current; i++) {
      await espera(CADA_MS);
      if (!montado.current) break;
      try {
        const t = await getTrabajo(id);
        fallos = 0;
        if (t.estado === 'impreso') return { fase: 'impreso' };
        if (t.estado === 'error') return { fase: 'error', mensaje: t.error ?? 'No se pudo imprimir' };
        if (t.estado === 'vencido') return { fase: 'error', mensaje: 'No se imprimió a tiempo. Probá de nuevo.' };
      } catch (e) {
        if (++fallos >= FALLOS_TOLERADOS) return { fase: 'error', mensaje: getErrorMessage(e) };
      }
    }
    return { fase: 'error', mensaje: 'La impresora no confirmó la impresión. Revisá si salió el ticket.' };
  };

  const onImprimir = async () => {
    if (!archivos || ocupado.current) return;
    ocupado.current = true;
    setAviso(null);
    setImpresion({ fase: 'enviando' });
    try {
      const ticket = await ticketARaster(archivos.ticket);
      const trabajo = await enviarTicket(ticket, remito._id);
      if (!montado.current) return;
      setImpresion({ fase: 'imprimiendo' });
      const final = await esperarResultado(trabajo.id);
      if (!montado.current) return;
      setImpresion(final);
      ocupado.current = false; // ya se puede pedir otro ticket
      if (final.fase === 'impreso') {
        await espera(4000); // el "Impreso" se ve unos segundos y vuelve a su lugar (si no se pidió otro mientras tanto)
        if (montado.current) setImpresion((actual) => (actual.fase === 'impreso' ? { fase: 'reposo' } : actual));
      }
    } catch (e) {
      if (!montado.current) return;
      const sinImpresora = isAxiosError(e) && e.response?.status === 503;
      setImpresion({
        fase: 'error',
        mensaje: sinImpresora
          ? 'La impresora no está conectada. Revisá que el equipo del puesto esté encendido.'
          : e instanceof TicketMuyLargo
            ? 'El ticket es demasiado largo para imprimirlo desde acá.'
            : getErrorMessage(e, 'No se pudo enviar el ticket a imprimir'),
      });
    } finally {
      ocupado.current = false;
    }
  };

  const onAbrirPdf = () => {
    if (!archivos) return;
    setAviso(abrirParaImprimir(archivos.ticket) ? null : 'El navegador bloqueó la ventana. Permitila e intentá de nuevo.');
  };

  const enCurso = impresion.fase === 'enviando' || impresion.fase === 'imprimiendo';

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" disabled={!listo} onClick={onCompartir}>
          <Share2 size={18} /> Compartir
        </Button>
        <Button variant="soft" disabled={!listo} onClick={() => archivos && descargar(archivos.digital)}>
          <Download size={18} /> Descargar
        </Button>
        <Button variant="soft" disabled={!listo || enCurso} loading={enCurso} onClick={onImprimir}>
          {impresion.fase === 'impreso' ? <Check size={18} /> : !enCurso && <Printer size={18} />}
          {impresion.fase === 'enviando' ? 'Enviando…' : impresion.fase === 'imprimiendo' ? 'Imprimiendo…' : impresion.fase === 'impreso' ? 'Impreso' : 'Imprimir'}
        </Button>
      </div>

      {impresion.fase === 'impreso' && <p role="status" className="text-sm text-success-700">Ticket impreso</p>}
      {impresion.fase === 'error' && (
        <div role="alert" className="space-y-1">
          <p className="text-sm text-danger-700">{impresion.mensaje}</p>
          <button type="button" className="text-sm underline" onClick={onAbrirPdf}>Abrir el ticket en PDF para imprimirlo desde otro equipo</button>
        </div>
      )}
      {aviso && <p role="alert" className="text-sm text-danger-700">{aviso}</p>}
    </div>
  );
}
