import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getErrorMessage } from '../lib/errors';
import { Navigate, useLocation } from 'react-router';
import { Receipt, Eye, EyeOff, ArrowRight, CircleX } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { loginSchema, type LoginForm } from '../lib/schemas';
import { useAuth } from '../context/useAuth';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { signIn, usuario } = useAuth();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      await signIn(values.email, values.password);
        } catch (err) {
      setServerError(getErrorMessage(err, 'No se pudo iniciar sesión'));
    }
  };

  // Si ya hay sesión (o se acaba de iniciar), se redirige a donde se quería ir
  if (usuario) return <Navigate to={from} replace />;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-glow">
            <Receipt size={26} />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Sistema de Remitos</h1>
            <p className="text-sm text-muted">Ingresá con tu usuario para continuar.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-5 p-8">
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl bg-danger-50 p-3 text-sm text-danger-700"
            >
              <CircleX size={18} className="mt-0.5 shrink-0" />
              {serverError}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            autoComplete="username"
            placeholder="tu@email.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            error={errors.password?.message}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="cursor-pointer text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
            {...register('password')}
          />

          <Button type="submit" large loading={isSubmitting} className="w-full">
            Ingresar <ArrowRight size={18} />
          </Button>

          <div className="text-center">
            <button type="button" className="link" onClick={() => setShowHelp((v) => !v)}>
              Olvidé mi clave
            </button>
            {showHelp && (
              <p className="mt-2 text-xs text-muted">
                Pedile a un administrador que restablezca tu contraseña.
              </p>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}