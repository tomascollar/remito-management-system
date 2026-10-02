import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';

type Props = ComponentProps<'select'> & {
  label: string;
  options: readonly string[];
  placeholder?: string; // primera opción, con valor vacío
  error?: string;
  hint?: string;
};

/** Desplegable nativo: en el celular abre el selector del sistema, que es lo más cómodo de usar. */
export function Select({
  label, options, placeholder = 'Seleccioná una opción', error, hint, id, className = '', ...rest
}: Props) {
  const selectId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={!!error}
          className={`input cursor-pointer appearance-none pr-11 ${error ? 'ring-danger-500 focus:ring-danger-500' : ''} ${className}`}
          {...rest}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
      {error ? (
        <p className="text-xs text-danger-700">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}