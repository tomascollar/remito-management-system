import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { Ellipsis, LogOut, Plus } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { itemsParaRol, type NavItem } from '../../config/navigation';
import { UserBadge } from './UserBadge';

export function MobileNav() {
  const { usuario, signOut } = useAuth();
  const [abierto, setAbierto] = useState(false); // hoja "Más"
  if (!usuario) return null;

  // Cada ítem declara en navigation.ts dónde va: barra, botón central o "Más"
  const items = itemsParaRol(usuario.rol);
  const barra = items.filter((i) => i.mobile === 'bar');
  const fab = items.find((i) => i.mobile === 'fab');
  const mas = items.filter((i) => i.mobile === 'more');

  // Distribución: [mitad de la barra] [+] [resto de la barra] [Más]
  const mitad = Math.ceil(barra.length / 2);

  return (
    <>
      {/* env(safe-area-inset-bottom) evita que la barra del iPhone tape los botones */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 items-end px-2 pt-2 pb-1">
          {barra.slice(0, mitad).map((item) => (
            <BarLink key={item.path} item={item} />
          ))}

          {/* Acción principal del sistema: siempre al alcance del pulgar */}
          {fab && (
            <Link
              to={fab.path}
              aria-label={fab.label}
              className="-mt-7 flex size-14 items-center justify-center justify-self-center rounded-full bg-primary-600 text-white shadow-glow ring-4 ring-canvas transition active:scale-95"
            >
              <Plus size={26} />
            </Link>
          )}

          {barra.slice(mitad).map((item) => (
            <BarLink key={item.path} item={item} />
          ))}

          <button
            onClick={() => setAbierto(true)}
            className="flex cursor-pointer flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted"
          >
            <Ellipsis size={22} />
            Más
          </button>
        </div>
      </nav>

      {/* Hoja inferior: opciones de rol, usuario y cierre de sesión */}
      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Más opciones">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAbierto(false)} />
          <div className="absolute inset-x-0 bottom-0 space-y-3 rounded-t-3xl bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-soft">
            <UserBadge usuario={usuario} />
            <div className="space-y-1">
              {mas.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setAbierto(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'text-ink hover:bg-canvas'
                    }`
                  }
                >
                  <Icon size={20} /> {label}
                </NavLink>
              ))}
              <button
                onClick={signOut}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-danger-700 hover:bg-danger-50"
              >
                <LogOut size={20} /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BarLink({ item: { label, path, icon: Icon } }: { item: NavItem }) {
  return (
    <NavLink
      to={path}
      end={path === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${
          isActive ? 'text-primary-700' : 'text-muted'
        }`
      }
    >
      <Icon size={22} />
      {label}
    </NavLink>
  );
}