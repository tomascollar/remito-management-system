import { LogOut } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/useAuth';

export default function Home() {
  const { usuario, signOut } = useAuth();

  return (
    <main className="mx-auto max-w-2xl p-6 md:p-10">
      <div className="card space-y-4 p-8">
        <h1 className="text-2xl font-bold">Hola, {usuario?.nombre}</h1>
        <p className="text-sm text-muted">Rol: {usuario?.rol}</p>
        <Button variant="soft" onClick={signOut}>
          <LogOut size={18} /> Cerrar sesión
        </Button>
      </div>
    </main>
  );
}