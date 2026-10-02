import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Área realmente visible de la pantalla, descontando el teclado.
 * En iOS Safari el teclado se dibuja ENCIMA de la página sin achicarla, así que un
 * elemento pegado abajo (como esta hoja) queda tapado. `visualViewport` informa el
 * tamaño y la posición del área visible, y nos suscribimos a sus cambios.
 * El valor es un string "top|alto" para que useSyncExternalStore compare estable.
 */
const suscribirse = (avisar: () => void) => {
  const vv = window.visualViewport;
  vv?.addEventListener('resize', avisar);
  vv?.addEventListener('scroll', avisar);
  return () => {
    vv?.removeEventListener('resize', avisar);
    vv?.removeEventListener('scroll', avisar);
  };
};
const leerAreaVisible = () => {
  const vv = window.visualViewport;
  return vv ? `${vv.offsetTop}|${vv.height}` : '';
};

/**
 * Hoja inferior en celular y ventana centrada en escritorio.
 * Se cierra con Escape o tocando el fondo, y bloquea el scroll de la página mientras está abierta.
 * Cuando está cerrada no renderiza nada, así el formulario de adentro se reinicia en cada apertura.
 * Se acomoda al área visible, así que con el teclado abierto la hoja queda justo encima de él.
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const area = useSyncExternalStore(suscribirse, leerAreaVisible, () => '');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Sin visualViewport (navegadores viejos) se usa la altura dinámica de la ventana
  const [top, alto] = area ? area.split('|').map(Number) : [0, 0];
  const estilo = area ? { top, height: alto } : { top: 0, height: '100dvh' };

  return (
    <div
      className="fixed inset-x-0 z-50 flex items-end justify-center md:items-center"
      style={estilo}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative max-h-[92%] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-soft md:max-w-md md:rounded-3xl md:pb-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="btn btn-ghost p-2">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
