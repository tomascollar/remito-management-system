import { Link } from 'react-router';
import { Boxes, FilePlus2, FileText } from 'lucide-react';
import { useAuth } from '../context/useAuth';

// Saludo según la hora local del dispositivo
function saludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

const accesos = [
  { to: '/nuevo-remito', label: 'Nuevo remito', desc: 'Cargar un remito', icon: FilePlus2, destacado: true },
  { to: '/remitos', label: 'Remitos', desc: 'Ver y corregir remitos', icon: FileText },
  { to: '/stock', label: 'Stock', desc: 'Consultar el stock vigente', icon: Boxes },
];

export default function Dashboard() {
  const { usuario } = useAuth();
  const fecha = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">
          {saludo()}, {usuario?.nombre.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted first-letter:uppercase">{fecha}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {accesos.map(({ to, label, desc, icon: Icon, destacado }) => (
          <Link
            key={to}
            to={to}
            className={`card flex flex-col gap-3 p-6 transition hover:-translate-y-px ${
              destacado ? 'bg-primary-600 text-white ring-0 shadow-glow' : ''
            }`}
          >
            <Icon size={24} />
            <div>
              <p className="font-semibold">{label}</p>
              <p className={`text-sm ${destacado ? 'text-primary-100' : 'text-muted'}`}>{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}