interface Option<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (id: T) => void;
  label?: string; // descripción para lectores de pantalla
}

/** Selector de una opción entre pocas (pestañas, sumar/restar). Cada opción es un botón. */
export function Segmented<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-2xl bg-canvas p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 cursor-pointer rounded-xl px-3 py-2 text-sm font-medium transition ${
            value === o.id ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
