/** Chip de estado: abierto (se puede modificar) o cerrado. */
export function EstadoRemito({ estado }: { estado: 'abierto' | 'cerrado' }) {
  return estado === 'abierto' ? (
    <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">Abierto</span>
  ) : (
    <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted">Cerrado</span>
  );
}
