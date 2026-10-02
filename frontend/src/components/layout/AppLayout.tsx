import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

/**
 * Marco común de todas las pantallas autenticadas. Cada página se renderiza
 * en <Outlet />. En escritorio el contenido se desplaza a la derecha del
 * sidebar (md:pl-64); en celular deja espacio abajo para la barra inferior.
 */
export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl p-5 pb-28 md:p-10">
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
}