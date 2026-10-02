import type { ComponentProps, ReactNode } from 'react';

type Props = ComponentProps<'input'> & {
  label: string;
  error?: string;
  hint?: string; // texto de ayuda; se oculta cuando hay un error
  trailing?: ReactNode;
};

export function Input({ label, error, hint, trailing, id, className = '', ...rest }: Props) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={!!error}
          className={`input ${error ? 'ring-danger-500 focus:ring-danger-500' : ''} ${trailing ? 'pr-12' : ''} ${className}`}
          {...rest}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-3 flex items-center">{trailing}</div>
        )}
      </div>
      {error ? (
        <p className="text-xs text-danger-700">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}