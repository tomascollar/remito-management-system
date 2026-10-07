import { useEffect, useState } from 'react';
import { Download, Printer, Share2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { abrirParaImprimir, compartir, crearArchivos, descargar, type ArchivosRemito } from '../../lib/pdf/acciones';
import type { Remito } from '../../types/remito';

/**
 * Botones para sacar el remito de la app: Compartir (PDF A5 por WhatsApp o mail),
 * Descargar (el mismo PDF) e Imprimir (ticket de 80 mm para la térmica).
 *
 * Los PDFs se generan por adelantado y se regeneran cada vez que cambia el remito. Así, cuando
 * se toca un botón el archivo ya está listo, algo necesario para que iOS permita compartir.
 */
export function RemitoAcciones({ remito }: { remito: Remito }) {
  const [archivos, setArchivos] = useState<ArchivosRemito | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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
      await compartir(archivos.digital, remito);
    } catch {
      setAviso('No se pudo compartir el remito');
    }
  };

  const onImprimir = () => {
    if (!archivos) return;
    setAviso(abrirParaImprimir(archivos.ticket) ? null : 'El navegador bloqueó la ventana. Permitila e intentá de nuevo.');
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" disabled={!listo} onClick={onCompartir}>
          <Share2 size={18} /> Compartir
        </Button>
        <Button variant="soft" disabled={!listo} onClick={() => archivos && descargar(archivos.digital)}>
          <Download size={18} /> Descargar
        </Button>
        <Button variant="soft" disabled={!listo} onClick={onImprimir}>
          <Printer size={18} /> Imprimir
        </Button>
      </div>
      {aviso && <p role="alert" className="text-sm text-danger-700">{aviso}</p>}
    </div>
  );
}
