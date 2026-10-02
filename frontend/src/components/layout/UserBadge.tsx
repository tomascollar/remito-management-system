import type { Usuario } from '../../types/auth';
import { rolLabel } from '../../config/navigation';

export function UserBadge({ usuario }: { usuario: Usuario }) {
  // Iniciales para el avatar: "Tomás Acosta" -> "TA"
  const iniciales = usuario.nombre
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
        {iniciales}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{usuario.nombre}</p>
        <p className="text-xs text-muted">{rolLabel[usuario.rol]}</p>
      </div>
    </div>
  );
}