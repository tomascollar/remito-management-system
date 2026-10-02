import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<'input'>, 'type'> & { label: string; hint?: string };

/** Interruptor accesible: es un checkbox real (teclado y lectores de pantalla) con aspecto de switch. */
export function Toggle({ label, hint, className = '', ...rest }: Props) {
  return (
    <label className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl bg-canvas p-4 ${className}`}>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" {...rest} />
      {/* "peer-checked" estiliza este span según el estado del checkbox anterior */}
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-muted/30 transition peer-checked:bg-primary-600 peer-focus-visible:ring-4 peer-focus-visible:ring-primary-200 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}