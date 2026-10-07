import { useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useLaboratorio } from '../../hooks/useLaboratorio';
import { getErrorMessage } from '../../lib/errors';
import { CostoBcrypt } from './CostoBcrypt';
import { FuerzaBruta } from './FuerzaBruta';
import { MatrizPermisos } from './MatrizPermisos';
import { RegistroEventos } from './RegistroEventos';
import { SesionJwt } from './SesionJwt';

/**
 * Laboratorio de seguridad: un panel para DEMOSTRAR las medidas de seguridad de la aplicación en
 * vivo (límite de intentos, vencimiento de sesión, costo de bcrypt, permisos por rol y registro
 * de eventos), cambiando los parámetros y viendo el efecto al instante.
 * Solo superadmin; solo existe si el servidor se inició con SECURITY_LAB=true.
 */
export default function Laboratorio() {
  const { estado, error, desactivado, reload, aplicar, restaurar } = useLaboratorio();
  const [errorRestaurar, setErrorRestaurar] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  const restaurarTodo = async () => {
    setRestaurando(true);
    setErrorRestaurar(null);
    try {
      await restaurar();
    } catch (e) {
      setErrorRestaurar(getErrorMessage(e, 'No se pudo restaurar'));
    } finally {
      setRestaurando(false);
    }
  };

  if (desactivado) {
    return (
      <div className="space-y-2 py-10 text-center">
        <p className="font-semibold">El laboratorio está desactivado</p>
        <p className="text-sm text-muted">
          Para usarlo, iniciá el servidor con <code className="rounded bg-canvas px-1.5 py-0.5">SECURITY_LAB=true</code> en el archivo .env y reinicialo.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-danger-700">{error}</p>
        <Button variant="soft" onClick={reload}>Reintentar</Button>
      </div>
    );
  }
  if (!estado) return <p className="py-10 text-center text-sm text-muted">Cargando laboratorio…</p>;

  return (
    // Las claves incluyen la configuración vigente para que, al restaurar, los formularios muestren los valores nuevos
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FlaskConical size={24} /> Laboratorio de seguridad
          </h1>
          <p className="text-sm text-muted">Cambiá los parámetros y mirá el efecto al instante.</p>
        </div>
        <Button variant="soft" onClick={restaurarTodo} loading={restaurando}>
          <RotateCcw size={16} /> Restaurar valores por defecto
        </Button>
      </header>

      <p role="note" className="rounded-2xl bg-warning-50 p-3 text-sm text-warning-700">
        Modo demostración. Los cambios viven en la memoria del servidor (al reiniciarlo vuelven a los valores por defecto) y este panel no debe estar activo en producción.
      </p>
      {errorRestaurar && <p role="alert" className="text-sm text-danger-700">{errorRestaurar}</p>}

      <FuerzaBruta key={`fb-${estado.config.loginMax}-${estado.config.loginVentanaSeg}`} estado={estado} aplicar={aplicar} />
      <SesionJwt key={`jwt-${estado.config.jwtDuracionSeg}`} estado={estado} aplicar={aplicar} />
      <RegistroEventos />
      <CostoBcrypt />
      <MatrizPermisos />
    </div>
  );
}
