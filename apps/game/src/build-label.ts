/** Fecha de la compilación inyectada por Vite, no la fecha en que se abre la página. */
export function buildLabel(version: string, timestamp: string) {
  const formatted = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
  return `v${version} · Compilado: ${formatted}`;
}
