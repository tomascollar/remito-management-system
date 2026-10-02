import { z } from 'zod';
import { CATEGORIAS, enCatalogo } from './catalogos';

export const loginSchema = z.object({
  email: z.string().min(1, 'Ingresá tu email').email('El email no es válido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

export type LoginForm = z.infer<typeof loginSchema>;

// Convierte "12,5" o "12.5" a número (NaN si no es válido)
const aNumero = (s: string) => Number(s.replace(',', '.'));

export const productoSchema = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
    categoria: z
    .string()
    .refine((v) => v === '' || enCatalogo(CATEGORIAS, v), 'Elegí una categoría de la lista'),
  permite_venta_fraccionada: z.boolean(),
  // Informativo y opcional: vacío es válido; si se completa, debe ser un número > 0
  cantidad_por_bulto: z
    .string()
    .trim()
    .refine((v) => v === '' || (Number.isFinite(aNumero(v)) && aNumero(v) > 0), 'Ingresá un número mayor a 0'),
});

export type ProductoFormValues = z.infer<typeof productoSchema>;