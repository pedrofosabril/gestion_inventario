/** Convierte fechas almacenadas como AAAA-MM-DD al formato visible DD/MM/AAAA. */
export function formatDisplayDate(date: string | null | undefined): string {
  if (!date) return '';

  const isoMatch = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }

  return String(date);
}
