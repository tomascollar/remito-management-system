import { useRef, useState } from 'react';
import { Play, RotateCcw, Square } from 'lucide-react';
import { intentoLoginFalso, reiniciarContadores } from '../../api/laboratorio';
import { Button } from '../../components/ui/Button';
import { getErrorMessage } from '../../lib/errors';
import { aEntero, describirDuracion } from '../../lib/laboratorio';
import type { ConfigSeguridad, EstadoLaboratorio, ResultadoIntento } from '../../types/laboratorio';
import { CampoNumero, Seccion } from './controles';

interface Props {
  estado: EstadoLaboratorio;
  aplicar: (cambios: Partial<ConfigSeguridad>) => Promise<void>;
}

/**
 * Demostración de la protección contra fuerza bruta (rate limiting del login).
 * 1) Se elige cuántos intentos fallidos tolera el servidor y en qué ventana de tiempo.
 * 2) Se lanzan intentos de login con credenciales falsas, de verdad, contra la API real.
 * 3) Cada cuadradito es un intento: ámbar = el servidor lo procesó (credenciales inválidas),
 *    rojo = el limitador lo bloqueó (429). Con 100 permitidos no pasa nada; con 5, se corta.
 */
export function FuerzaBruta({ estado, aplicar }: Props) {
  const { config, limites } = estado;
  const [max, setMax] = useState(String(config.loginMax));
  const [ventana, setVentana] = useState(String(config.loginVentanaSeg));
  const [cantidad, setCantidad] = useState('10');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [intentos, setIntentos] = useState<ResultadoIntento[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const detener = useRef(false);

  const maxNum = aEntero(max);
  const ventanaNum = aEntero(ventana);
  const hayCambios = maxNum !== config.loginMax || ventanaNum !== config.loginVentanaSeg;

  const aplicarCambios = async () => {
    if (maxNum === null || ventanaNum === null) return;
    setError(null);
    try {
      await aplicar({ loginMax: maxNum, loginVentanaSeg: ventanaNum });
      setIntentos([]);
      setMensaje(`Aplicado: ${maxNum} intentos fallidos cada ${describirDuracion(ventanaNum)}. Los contadores arrancaron de cero.`);
    } catch (e) {
      setMensaje(null);
      setError(getErrorMessage(e, 'No se pudo aplicar'));
    }
  };

  const lanzar = async () => {
    const total = aEntero(cantidad);
    if (total === null || total < 1) return;
    detener.current = false;
    setCorriendo(true);
    setError(null);
    setIntentos([]);
    try {
      for (let i = 1; i <= Math.min(total, 500); i++) {
        if (detener.current) break;
        const resultado = await intentoLoginFalso(i);
        setIntentos((prev) => [...prev, resultado]);
        await new Promise((r) => setTimeout(r, 60)); // pausa breve para que se vea cómo avanza
      }
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo conectar con el servidor'));
    } finally {
      setCorriendo(false);
    }
  };

  const reiniciar = async () => {
    detener.current = true;
    setError(null);
    try {
      await reiniciarContadores();
      setIntentos([]);
      setMensaje('Contadores en cero: el atacante puede volver a intentar.');
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo reiniciar'));
    }
  };

  const bloqueados = intentos.filter((i) => i.estado === 429).length;
  const procesados = intentos.length - bloqueados;
  const ultimo = intentos[intentos.length - 1];
  const primerBloqueo = intentos.findIndex((i) => i.estado === 429);

  return (
    <Seccion
      titulo="Fuerza bruta: límite de intentos de login"
      descripcion="Un atacante prueba contraseñas una tras otra. El servidor cuenta los intentos fallidos por IP y, al pasar el límite, deja de responder durante la ventana de tiempo."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoNumero
          etiqueta="Intentos fallidos permitidos"
          valor={max}
          onChange={setMax}
          rango={limites.loginMax}
          ayuda="Por IP, dentro de la ventana"
        />
        <CampoNumero
          etiqueta="Ventana de tiempo"
          valor={ventana}
          onChange={setVentana}
          sufijo="segundos"
          rango={limites.loginVentanaSeg}
          ayuda={ventanaNum ? `= ${describirDuracion(ventanaNum)}` : undefined}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={aplicarCambios} disabled={!hayCambios || maxNum === null || ventanaNum === null}>
          Aplicar
        </Button>
        <span className="text-sm text-muted">
          En vigor: <strong className="text-ink">{config.loginMax}</strong> intentos cada{' '}
          <strong className="text-ink">{describirDuracion(config.loginVentanaSeg)}</strong>
        </span>
      </div>
      {mensaje && <p className="text-sm text-success-700">{mensaje}</p>}
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}

      <hr className="border-black/5" />

      <div className="space-y-3">
        <h3 className="font-semibold">Simular un ataque</h3>
        <p className="text-sm text-muted">
          Envía intentos de login reales con una contraseña falsa. Todos van a fallar; lo que se ve es cuándo el servidor deja de dejarlos pasar.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <CampoNumero etiqueta="Intentos a enviar" valor={cantidad} onChange={setCantidad} />
          </div>
          {corriendo ? (
            <Button variant="soft" onClick={() => (detener.current = true)}>
              <Square size={16} /> Detener
            </Button>
          ) : (
            <Button onClick={lanzar} disabled={aEntero(cantidad) === null || Number(cantidad) < 1}>
              <Play size={16} /> Lanzar ataque
            </Button>
          )}
          <Button variant="soft" onClick={reiniciar}>
            <RotateCcw size={16} /> Reiniciar contadores
          </Button>
        </div>

        {intentos.length > 0 && (
          <div className="space-y-3 rounded-2xl bg-canvas p-4">
            <ul className="flex flex-wrap gap-1" aria-label="Resultado de cada intento">
              {intentos.map((i, n) => (
                <li
                  key={n}
                  title={`Intento ${n + 1}: ${i.estado === 429 ? 'bloqueado (429)' : 'procesado (400, credenciales inválidas)'}`}
                  className={`h-4 w-4 rounded-sm ${i.estado === 429 ? 'bg-danger-500' : 'bg-warning-500'}`}
                />
              ))}
            </ul>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-warning-500 align-middle" />{procesados} procesados por el servidor</span>
              <span><span className="mr-1 inline-block h-3 w-3 rounded-sm bg-danger-500 align-middle" />{bloqueados} bloqueados</span>
              {ultimo?.restantes != null && ultimo.estado !== 429 && (
                <span className="text-muted">Quedan {ultimo.restantes} de {ultimo.limite} intentos</span>
              )}
            </div>
            {primerBloqueo >= 0 ? (
              <p role="status" className="text-sm font-medium text-danger-700">
                El servidor cortó el ataque en el intento {primerBloqueo + 1}: «{intentos[primerBloqueo].mensaje}»
              </p>
            ) : (
              !corriendo && (
                <p role="status" className="text-sm font-medium text-warning-700">
                  Ningún intento fue bloqueado: con este límite el atacante podría seguir probando.
                </p>
              )
            )}
          </div>
        )}
      </div>
    </Seccion>
  );
}
