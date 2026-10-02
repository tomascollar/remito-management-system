import { z } from 'zod';

export const clienteSchema = z.object({
  nombre_cliente: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
});

export type ClienteValues = z.infer<typeof clienteSchema>;
