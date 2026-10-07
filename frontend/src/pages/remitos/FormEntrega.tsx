import { useState } from 'react';
import { CircleX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getErrorMessage } from '../../lib/errors';
import { formatMoneda } from '../../lib/format';
import { aNumero } from '../../lib/stockSchemas';

interface Props {
  saldo: number;
  /** Registra la entrega. Debe lanzar el error si falla, para mostrarlo en el formulario. */
  onGuardar: (monto: number, nota?: string) => Promise<void>;
}

/**
 * Contenido del modal "Registrar entrega" (pago a cuenta). No deja pasar del saldo pendiente
 * (el servidor también lo verifica) y ofrece "Todo el saldo" para cobrar de una vez lo que falta.
 */
export function FormEntrega({ saldo, onGuardar }: Props) {
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const monto = aNumero(texto);
  const valido = texto.trim() !== '' && Number.isFinite(monto) && monto > 0;
  const excede = valido && monto > saldo;
  const notaInvalida = /[<>]/.test(nota);

  const guardar = async () => {
    if (!valido || excede || notaInvalida) return;
    setEnviando(true);
    setError(null);
    try {
      await onGuardar(monto, nota.trim() || undefined);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo registrar la entrega'));
      setEnviando(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <div className="flex items-baseline justify-between rounded-2xl bg-canvas p-4">
        <span className="text-sm text-muted">Saldo pendiente</span>
        <span className="text-xl font-bold">{formatMoneda(saldo)}</span>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-50 p-3 text-sm text-danger-700">
          <CircleX size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <Input
        label="Monto entregado"
        name="monto"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        error={excede ? `No puede superar el saldo (${formatMoneda(saldo)})` : undefined}
        trailing={
          <button
            type="button"
            className="cursor-pointer text-xs font-semibold text-primary-700"
            onClick={() => setTexto(String(saldo).replace('.', ','))}
          >
            Todo
          </button>
        }
      />

      <Input
        label="Nota (opcional)"
        name="nota"
        autoComplete="off"
        maxLength={100}
        placeholder="Efectivo, transferencia…"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        error={notaInvalida ? 'No puede contener < ni >' : undefined}
      />

      <Button type="submit" large className="w-full" loading={enviando} disabled={!valido || excede || notaInvalida}>
        Registrar entrega
      </Button>
    </form>
  );
}
