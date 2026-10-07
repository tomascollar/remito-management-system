import { useState } from 'react';
import { Timer } from 'lucide-react';
import { medirBcrypt } from '../../api/laboratorio';
import { Button } from '../../components/ui/Button';
import { getErrorMessage } from '../../lib/errors';
import type { MedicionBcrypt } from '../../types/laboratorio';
import { Seccion } from './controles';

const COSTOS = [8, 10, 12, 13];

/**
 * Demostración del costo de bcrypt. Las contraseñas se guardan hasheadas con bcrypt, que es lento
 * a propósito: cada +1 de costo duplica el trabajo. Para un usuario que inicia sesión son
 * milisegundos; para un atacante que prueba millones de contraseñas es una barrera enorme.
 */
export function CostoBcrypt() {
  const [mediciones, setMediciones] = useState<MedicionBcrypt[]>([]);
  const [midiendo, setMidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const medir = async () => {
    setMidiendo(true);
    setError(null);
    setMediciones([]);
    try {
      for (const costo of COSTOS) {
        const m = await medirBcrypt(costo);
        setMediciones((prev) => [...prev, m]);
      }
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo medir'));
    } finally {
      setMidiendo(false);
    }
  };

  const mayor = Math.max(1, ...mediciones.map((m) => m.ms));

  return (
    <Seccion
      titulo="Contraseñas: costo de bcrypt"
      descripcion="Las contraseñas nunca se guardan: se guarda un hash. bcrypt es lento a propósito y el «costo» regula cuánto: cada +1 duplica el tiempo de cálculo."
    >
      <div>
        <Button onClick={medir} loading={midiendo}>
          <Timer size={16} /> Medir costos {COSTOS.join(', ')}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
      {mediciones.length > 0 && (
        <ul className="space-y-2" aria-label="Tiempo de hasheo por costo">
          {mediciones.map((m) => (
            <li key={m.costo} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>
                  Costo {m.costo} <span className="text-muted">({(2 ** m.costo).toLocaleString('es-AR')} vueltas)</span>
                </span>
                <span className="font-semibold tabular-nums">{m.ms.toLocaleString('es-AR')} ms</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/5">
                <div className="h-full bg-primary-500 transition-[width]" style={{ width: `${Math.max(2, (m.ms / mayor) * 100)}%` }} />
              </div>
              <p className="break-all font-mono text-xs text-muted">{m.hash}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        Cada hash lleva una «sal» aleatoria incluida: la misma contraseña genera hashes distintos, y por eso no sirven las tablas de hashes precalculados.
      </p>
    </Seccion>
  );
}
