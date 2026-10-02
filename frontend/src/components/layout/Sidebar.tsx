import { NavLink } from 'react-router';
import { LogOut, Receipt } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { itemsParaRol, type NavItem } from '../../config/navigation';
import { UserBadge } from './UserBadge';

export function Sidebar() {
  const { usuario, signOut } = useAuth();
  if (!usuario) return null;

  // Se arma según el rol: los ítems de administración van en su propio grupo
  const items = itemsParaRol(usuario.rol);
  const principales = items.filter((i) => !i.admin);
  const admin = items.filter((i) => i.admin);

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-black/5 bg-surface p-4 md:flex">
      <div className="flex items-center gap-3 px-3 py-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary-600 text-white">
          <Receipt size={18} />
        </div>
        <span className="text-lg font-bold tracking-tight">Remitos</span>
      </div>

      <nav className="mt-4 flex-1 space-y-6 overflow-y-auto">
        <NavGroup items={principales} />
        {admin.length > 0 && (
          <div className="space-y-1">
            <p className="px-4 text-xs font-semibold uppercase tracking-wide text-muted">
              Administración
            </p>
            <NavGroup items={admin} />
          </div>
        )}
      </nav>

      <div className="border-t border-line pt-4">
        <UserBadge usuario={usuario} />
        <button onClick={signOut} className="btn btn-ghost mt-3 w-full justify-start">
          <LogOut size={18} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

/** Lista de enlaces; NavLink marca como activo el que coincide con la URL actual. */
function NavGroup({ items }: { items: NavItem[] }) {
  return (
    <div className="space-y-1">
      {items.map(({ label, path, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'} // "/" coincidiría con todas las rutas si no fuera exacto
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
              isActive ? 'bg-primary-50 text-primary-700' : 'text-muted hover:bg-canvas hover:text-ink'
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </div>
  );
}