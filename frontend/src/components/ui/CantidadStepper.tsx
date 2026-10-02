import { Minus, Plus } from 'lucide-react';
import { aNumero } from '../../lib/stockSchemas';

interface Props {
  value: string; // texto, para admitir coma decimal mientras se escribe
  onChange: (valor: string) => void;
}

/** Cantidad con botones grandes de −/+ (de a 1, sin bajar de 1) y campo editable en el medio. */
export function CantidadStepper({ value, onChange }: Props) {
  const n = aNumero(value);
  const valida = Number.isFinite(n) && n > 0;

  /** Suma o resta de a 1; redondea para evitar 0,30000000000000004. */
  const mover = (delta: number) => {
    const base = valida ? n : 0;
    if (base + delta <= 0) return;
    onChange(String(Math.round((base + delta) * 100) / 100).replace('.', ','));
  };

  return (
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Restar uno" onClick={() => mover(-1)} className="btn btn-soft size-14 shrink-0 p-0">
        <Minus size={22} />
      </button>
      <input
        aria-label="Cantidad"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input h-14 text-center text-2xl font-bold"
      />
      <button type="button" aria-label="Sumar uno" onClick={() => mover(1)} className="btn btn-soft size-14 shrink-0 p-0">
        <Plus size={22} />
      </button>
    </div>
  );
}
