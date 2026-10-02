import type { ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'btn-primary',
  soft: 'btn-soft',
  ghost: 'btn-ghost',
} as const;

type Props = ComponentProps<'button'> & {
  variant?: keyof typeof variants;
  large?: boolean;
  loading?: boolean;
};

export function Button({
  variant = 'primary', large, loading, className = '', children, disabled, ...rest
}: Props) {
  return (
    <button
      className={`btn ${variants[variant]} ${large ? 'btn-lg' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={18} className="animate-spin" />}
      {children}
    </button>
  );
}