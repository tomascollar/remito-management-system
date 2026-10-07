import type { ReactNode } from 'react';

/** Tarjeta con título y explicación, común a todas las secciones del laboratorio. */
export function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-bold">{titulo}</h2>
        <p className="text-sm text-muted">{descripcion}</p>
      </header>
      {children}
    </section>
  );
}

interface CampoNumeroProps {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  sufijo?: string;
  rango?: [number, number];
  ayuda?: string;
}

/** Campo numérico con su unidad y el rango que acepta el servidor. */
export function CampoNumero({ etiqueta, valor, onChange, sufijo, rango, ayuda }: CampoNumeroProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{etiqueta}</span>
      <div className="flex items-center gap-2">
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={rango?.[0]}
          max={rango?.[1]}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />
        {sufijo && <span className="shrink-0 text-sm text-muted">{sufijo}</span>}
      </div>
      {(ayuda || rango) && (
        <span className="block text-xs text-muted">
          {ayuda}
          {ayuda && rango ? ' · ' : ''}
          {rango ? `Entre ${rango[0]} y ${rango[1]}` : ''}
        </span>
      )}
    </label>
  );
}
