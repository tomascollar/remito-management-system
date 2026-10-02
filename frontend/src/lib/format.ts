const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const cantidad = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/** 12000 -> "$ 12.000" */
export const formatMoneda = (n: number) => moneda.format(n);

/** 8.5 -> "8,5" (formato argentino, hasta 2 decimales) */
export const formatCantidad = (n: number) => cantidad.format(n);

/** Minúsculas y sin tildes, para que "aji" encuentre "Ají". */
export const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
