import { useState } from 'react';
import { CircleX } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Segmented } from '../../components/ui/Segmented';
import { Toggle } from '../../components/ui/Toggle';
import { getErrorMessage } from '../../lib/errors';
import { formatMoneda } from '../../lib/format';
import { aNumero } from '../../lib/stockSchemas';

type Tipo = 'suma' | 'resta';

interface Props {
  /** Agrega el ajuste (monto con signo). Debe lanzar el error si falla, para mostrarlo en el formulario. */
  onGuardar: (concepto: string, monto: number, resaltado: boolean) => Promise<void>;
}

// Atajos de texto para los casos más comunes de cada tipo
const SUGERENCIAS: Record<Tipo, string[]> = {
  suma: ['Saldo pendiente'],
  resta: ['Descuento', 'Vacíos devueltos'],
};

/**
 * Contenido del modal "Agregar ajuste": una línea sin producto ni stock que suma (saldo
 * anterior, recargo) o resta (descuento) al total. El usuario escribe el monto sin signo y
 * elige si suma o resta, así no tiene que tipear un "-".
 */
export function FormAjuste({ onGuardar }: Props) {
  const [tipo, setTipo] = useState<Tipo>('suma');
  const [concepto, setConcepto] = useState('');
  const [texto, setTexto] = useState('');
  const [resaltado, setResaltado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const magnitud = aNumero(texto);
  const valido = texto.trim() !== '' && Number.isFinite(magnitud) && magnitud > 0;
  const conceptoLimpio = concepto.trim();
  const conceptoInvalido = /[<>]/.test(concepto);
  const puedeGuardar = valido && conceptoLimpio !== '' && !conceptoInvalido;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setEnviando(true);
    setError(null);
    try {
      await onGuardar(conceptoLimpio, tipo === 'suma' ? magnitud : -magnitud, resaltado);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo agregar el ajuste'));
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
      <Segmented<Tipo>
        label="Tipo de ajuste"
        value={tipo}
        onChange={setTipo}
        options={[
          { id: 'suma', label: 'Suma al total' },
          { id: 'resta', label: 'Resta del total' },
        ]}
      />

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-50 p-3 text-sm text-danger-700">
          <CircleX size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Input
          label="Concepto"
          name="concepto"
          autoComplete="off"
          maxLength={100}
          placeholder="Saldo anterior, descuento…"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          error={conceptoInvalido ? 'No puede contener < ni >' : undefined}
        />
        <div className="flex flex-wrap gap-2">
          {SUGERENCIAS[tipo].map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-soft px-3 py-1.5 text-xs"
              onClick={() => setConcepto(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Monto"
        name="monto"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      <Toggle
        label="Resaltar línea"
        hint="En el PDF y el ticket esta línea se ve destacada, como con un resaltador."
        checked={resaltado}
        onChange={(e) => setResaltado(e.target.checked)}
      />

      <div className="flex items-baseline justify-between rounded-2xl bg-canvas p-4">
        <span className="text-sm text-muted">{tipo === 'suma' ? 'Se suma' : 'Se resta'}</span>
        <span className="text-xl font-bold">{valido ? formatMoneda(tipo === 'suma' ? magnitud : -magnitud) : '—'}</span>
      </div>

      <Button type="submit" large className="w-full" loading={enviando} disabled={!puedeGuardar}>
        Agregar ajuste
      </Button>
    </form>
  );
}
