import {
  LayoutDashboard, FilePlus2, FileText, Boxes, Package, Users, FlaskConical, type LucideIcon,
} from 'lucide-react';
import type { Rol } from '../types/auth';

/** Roles con acceso a la gestión (productos, stock, historial). Una sola definición para que no se desalineen. */
export const ROLES_ADMINISTRACION: Rol[] = ['superadmin', 'administrador'];

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles?: Rol[];                     // si se omite, lo ven todos los roles
  admin?: boolean;                   // se agrupa bajo "Administración" en el sidebar
  mobile: 'bar' | 'fab' | 'more';    // dónde aparece en el celular
}

/**
 * ÚNICA fuente de verdad de la navegación: el sidebar, la barra móvil y los
 * guards de ruta leen de acá. Así los permisos no se desalinean entre sí.
 * Deben reflejar lo que permite el backend (verificarRol); ahí está la
 * protección real, esto solo evita mostrar opciones que darían 403.
 */
export const navItems: NavItem[] = [
  { label: 'Inicio', path: '/', icon: LayoutDashboard, mobile: 'bar' },
  { label: 'Nuevo remito', path: '/nuevo-remito', icon: FilePlus2, mobile: 'fab' },
  { label: 'Remitos', path: '/remitos', icon: FileText, mobile: 'bar' },
  { label: 'Stock', path: '/stock', icon: Boxes, mobile: 'bar' },
  { label: 'Productos', path: '/productos', icon: Package, roles: ROLES_ADMINISTRACION, admin: true, mobile: 'more' },
  { label: 'Usuarios', path: '/usuarios', icon: Users, roles: ['superadmin'], admin: true, mobile: 'more' },
  // Demostración de seguridad: solo superadmin (y solo funciona si el servidor tiene SECURITY_LAB=true)
  { label: 'Laboratorio', path: '/laboratorio', icon: FlaskConical, roles: ['superadmin'], admin: true, mobile: 'more' },
];

export const rolLabel: Record<Rol, string> = {
  superadmin: 'Superadmin',
  administrador: 'Administrador',
  vendedor: 'Vendedor',
};

/** Ítems de menú visibles para un rol. */
export const itemsParaRol = (rol: Rol) =>
  navItems.filter((i) => !i.roles || i.roles.includes(rol));

/**
 * Roles permitidos para una ruta; se usa en <ProtectedRoute roles={...}>.
 * Si la ruta no existe en el menú lanza un error: devolver "undefined" dejaría la ruta SIN
 * restricción (todos pasan), y un error de tipeo en la ruta abriría la puerta sin avisar.
 */
export const rolesDe = (path: string) => {
  const item = navItems.find((i) => i.path === path);
  if (!item) throw new Error(`rolesDe: la ruta "${path}" no está definida en navItems`);
  return item.roles;
};