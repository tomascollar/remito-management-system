import { z } from 'zod';

/** "12,5" o "12.5" -> 12.5 (NaN si no es un número válido). */
export const aNumero = (s: string) => Number(s.trim().replace(',', '.'));

/** Campo de texto que debe ser un número mayor a 0 (admite coma decimal). */
const positivo = (mensaje: string) =>
  z
    .string()
    .trim()
    .refine((v) => v !== '' && Number.isFinite(aNumero(v)) && aNumero(v) > 0, mensaje);

/** Campo opcional: vacío, o un número mayor a 0. */
const opcionalPositivo = (mensaje: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (Number.isFinite(aNumero(v)) && aNumero(v) > 0), mensaje);

export const agregarSchema = z.object({
  cantidad: positivo('Ingresá un número mayor a 0'),
});

export const ajusteSchema = z.object({
  tipo: z.enum(['sumar', 'restar']),
  cantidad: positivo('Ingresá un número mayor a 0'),
  observaciones: z.string().trim().max(200, 'Máximo 200 caracteres'),
});

/** El precio por unidad solo es obligatorio si el producto es fraccionable (igual que en el backend). */
export const crearNuevoStockSchema = (fraccionable: boolean) =>
  z.object({
    cantidad: positivo('Ingresá la cantidad de bultos'),
    precio_bulto: positivo('Ingresá el precio por bulto'),
    precio_unidad: fraccionable ? positivo('Ingresá el precio por unidad') : z.string().trim(),
    precio_unidad_x_bulto: opcionalPositivo('Ingresá un número mayor a 0, o dejalo vacío'),
  });

export const crearPrecioSchema = (fraccionable: boolean) =>
  z.object({
    precio_bulto: positivo('Ingresá el precio por bulto'),
    precio_unidad: fraccionable ? positivo('Ingresá el precio por unidad') : z.string().trim(),
    precio_unidad_x_bulto: opcionalPositivo('Ingresá un número mayor a 0, o dejalo vacío'),
  });

export type AgregarValues = z.infer<typeof agregarSchema>;
export type AjusteValues = z.infer<typeof ajusteSchema>;
export type NuevoStockValues = z.infer<ReturnType<typeof crearNuevoStockSchema>>;
export type PrecioValues = z.infer<ReturnType<typeof crearPrecioSchema>>;
