const MIN_YEAR = 1990;

/** Año máximo aceptado: el actual + 1 (tolera leves desfasajes de reloj). */
export function maxPlausibleYear(): number {
  return new Date().getFullYear() + 1;
}

/** ¿El año es razonable para una fecha de movimiento? */
export function isPlausibleYear(year: number): boolean {
  return Number.isFinite(year) && year >= MIN_YEAR && year <= maxPlausibleYear();
}

/**
 * true si la fecha está vacía o es una fecha ISO con año válido.
 * Se usa para descartar registros con fechas corruptas (p. ej. "830-01-01").
 */
export function isValidMovementDate(value: string | null | undefined): boolean {
  if (!value) return true;
  const s = String(value).trim();
  if (!s) return true;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return isPlausibleYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** Convierte fechas almacenadas (AAAA-MM-DD o AAAA-MM-DDTHH:mm) al formato visible DD/MM/AAAA. */
export function formatDisplayDate(date: string | null | undefined): string {
  if (!date) return '';
  const s = String(date).trim();
  if (!s) return '';

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const year = Number(iso[1]);
    if (!isPlausibleYear(year)) return '';
    return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  }

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? Number(`20${dmy[3]}`) : Number(dmy[3]);
    if (!isPlausibleYear(year)) return '';
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }

  // Cualquier otro formato (números sueltos, texto) no se muestra como fecha.
  return '';
}
