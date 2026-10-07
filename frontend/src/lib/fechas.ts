const fechaHora = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "2026-10-01T14:35:00Z" -> "1 oct, 11:35" (hora local del dispositivo) */
export const formatFechaHora = (iso: string) => fechaHora.format(new Date(iso));

/** Medianoche de hoy (hora local) en ISO, para filtrar "remitos de hoy". */
export const inicioDeHoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/** Medianoche de hace `dias` días (hora local) en ISO. Con 0 es igual a `inicioDeHoy()`. */
export const inicioHaceDias = (dias: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dias);
  return d.toISOString();
};
