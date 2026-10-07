import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { consultarConToken, emitirTokenDemo } from '../../api/laboratorio';
import { Button } from '../../components/ui/Button';
import { getErrorMessage } from '../../lib/errors';
import { ahoraMs, aEntero, decodificarPayload, describirDuracion, formatHora, formatRestante } from '../../lib/laboratorio';
import type { ConfigSeguridad, EstadoLaboratorio, ResultadoConsulta, TokenDemo } from '../../types/laboratorio';
import { CampoNumero, Seccion } from './controles';

interface Props {
  estado: EstadoLaboratorio;
  aplicar: (cambios: Partial<ConfigSeguridad>) => Promise<void>;
}

interface Chequeo extends ResultadoConsulta {
  hora: number;
}

const CADA_MS = 2000;

/**
 * Demostración de la expiración de sesión (JWT).
 * - "Duración de la sesión" es la configuración real: afecta a los próximos inicios de sesión.
 * - El token de prueba permite ver la expiración sin cerrar la sesión de quien presenta: se emite
 *   uno corto, se ve la cuenta regresiva y cómo el servidor, que lo aceptaba, pasa a rechazarlo.
 */
export function SesionJwt({ estado, aplicar }: Props) {
  const { config, limites } = estado;
  const [duracion, setDuracion] = useState(String(config.jwtDuracionSeg));
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [duracionDemo, setDuracionDemo] = useState('30');
  const [demo, setDemo] = useState<{ datos: TokenDemo; desfase: number } | null>(null);
  const [ahora, setAhora] = useState(0);
  const [chequeos, setChequeos] = useState<Chequeo[]>([]);
  const [rechazado, setRechazado] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);

  const duracionNum = aEntero(duracion);

  const aplicarDuracion = async () => {
    if (duracionNum === null) return;
    setError(null);
    try {
      await aplicar({ jwtDuracionSeg: duracionNum });
      setMensaje(`Aplicado: los próximos inicios de sesión durarán ${describirDuracion(duracionNum)}.`);
    } catch (e) {
      setMensaje(null);
      setError(getErrorMessage(e, 'No se pudo aplicar'));
    }
  };

  const emitir = async () => {
    const seg = aEntero(duracionDemo);
    if (seg === null) return;
    setEmitiendo(true);
    setError(null);
    try {
      const datos = await emitirTokenDemo(seg);
      // Desfase entre el reloj del servidor y el de este dispositivo: la cuenta regresiva
      // se calcula con la hora del servidor, que es la que decide si el token venció.
      const desfase = datos.ahora - ahoraMs();
      setDemo({ datos, desfase });
      setAhora(ahoraMs() + desfase);
      setChequeos([]);
      setRechazado(false);
      void consultar(datos.token); // primera consulta inmediata: aceptado
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo emitir el token'));
    } finally {
      setEmitiendo(false);
    }
  };

  const consultar = async (token: string) => {
    try {
      const r = await consultarConToken(token);
      setChequeos((prev) => [{ ...r, hora: ahoraMs() }, ...prev].slice(0, 12));
      if (r.estado !== 200) setRechazado(true);
    } catch {
      // Sin conexión: se reintenta en la próxima vuelta
    }
  };

  // Mientras el token esté vigente: reloj de la cuenta regresiva y consulta periódica al servidor.
  // En cuanto el servidor lo rechaza, se detiene todo (así el registro no se llena de repeticiones).
  useEffect(() => {
    if (!demo || rechazado) return;
    const reloj = setInterval(() => setAhora(ahoraMs() + demo.desfase), 250);
    const consulta = setInterval(() => void consultar(demo.datos.token), CADA_MS);
    return () => {
      clearInterval(reloj);
      clearInterval(consulta);
    };
  }, [demo, rechazado]);

  const restante = demo ? demo.datos.venceEn - ahora : 0;
  const total = demo ? demo.datos.venceEn - demo.datos.emitidoEn : 1;
  const porcentaje = demo ? Math.max(0, Math.min(100, (restante / total) * 100)) : 0;
  const payload = demo ? decodificarPayload(demo.datos.token) : null;
  const vencido = demo !== null && restante <= 0;

  return (
    <Seccion
      titulo="Sesión: expiración del token (JWT)"
      descripcion="Al iniciar sesión el servidor entrega un token con fecha de vencimiento. Pasado ese momento lo rechaza y hay que volver a iniciar sesión: así una sesión robada o olvidada deja de servir."
    >
      <div className="space-y-3">
        <CampoNumero
          etiqueta="Duración de la sesión"
          valor={duracion}
          onChange={setDuracion}
          sufijo="segundos"
          rango={limites.jwtDuracionSeg}
          ayuda={duracionNum ? `= ${describirDuracion(duracionNum)}` : undefined}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={aplicarDuracion} disabled={duracionNum === null || duracionNum === config.jwtDuracionSeg}>
            Aplicar
          </Button>
          {[120, 28800].map((seg) => (
            <button
              key={seg}
              type="button"
              onClick={() => setDuracion(String(seg))}
              className="cursor-pointer rounded-full bg-surface px-3 py-1.5 text-sm text-muted ring-1 ring-black/5 hover:text-ink"
            >
              {describirDuracion(seg)}
            </button>
          ))}
          <span className="text-sm text-muted">
            En vigor: <strong className="text-ink">{describirDuracion(config.jwtDuracionSeg)}</strong>
          </span>
        </div>
        <p className="text-xs text-muted">
          Es la configuración real: afecta a los inicios de sesión que se hagan desde ahora. Las sesiones ya abiertas conservan su vencimiento original.
        </p>
        {mensaje && <p className="text-sm text-success-700">{mensaje}</p>}
        {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
      </div>

      <hr className="border-black/5" />

      <div className="space-y-3">
        <h3 className="font-semibold">Probar con un token de demostración</h3>
        <p className="text-sm text-muted">
          Emite un token corto para tu usuario (no toca tu sesión actual) y consulta la API con él cada pocos segundos, hasta que el servidor deje de aceptarlo.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <CampoNumero etiqueta="Duración del token" valor={duracionDemo} onChange={setDuracionDemo} sufijo="s" />
          </div>
          <Button onClick={emitir} loading={emitiendo} disabled={aEntero(duracionDemo) === null}>
            <KeyRound size={16} /> Emitir token
          </Button>
        </div>

        {demo && (
          <div className="space-y-3 rounded-2xl bg-canvas p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className={`text-3xl font-bold tabular-nums ${vencido ? 'text-danger-700' : ''}`}>{formatRestante(restante)}</p>
              <p className="text-xs text-muted">
                Emitido {formatHora(demo.datos.emitidoEn)} · vence {formatHora(demo.datos.venceEn)}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/5" aria-hidden>
              <div
                className={`h-full transition-[width] duration-300 ${vencido ? 'bg-danger-500' : 'bg-primary-500'}`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            {payload && (
              <p className="break-all font-mono text-xs text-muted">
                Contenido del token: {JSON.stringify({ rol: payload.rol, iat: payload.iat, exp: payload.exp })}
              </p>
            )}
            <ul className="space-y-1 text-sm" aria-label="Respuestas del servidor">
              {chequeos.map((c, n) => (
                <li key={`${c.hora}-${n}`} className={c.estado === 200 ? 'text-success-700' : 'font-semibold text-danger-700'}>
                  <span className="mr-2 font-mono text-xs text-muted">{formatHora(c.hora)}</span>
                  {c.estado === 200 ? '✔' : '✘'} {c.estado} · {c.mensaje}
                </li>
              ))}
            </ul>
            {rechazado && (
              <p role="status" className="text-sm font-medium text-danger-700">
                El servidor rechazó el token porque venció: es lo que le pasaría a una sesión real cuando se cumple su duración.
              </p>
            )}
          </div>
        )}
      </div>
    </Seccion>
  );
}
