const LIMA_TIME_ZONE = 'America/Lima';

/**
 * Returns YYYY-MM-DD in America/Lima regardless of the browser's local timezone.
 */
export function fechaLimaDesdeDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(p => p.type === 'year')?.value ?? '';
  const month = parts.find(p => p.type === 'month')?.value ?? '';
  const day = parts.find(p => p.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

export function fechaHoyLima(now: Date = new Date()): string {
  return fechaLimaDesdeDate(now);
}

/**
 * Returns true if the given ISO timestamp (or YYYY-MM-DD date string) falls on
 * today's calendar date in America/Lima.
 */
export function esMismoDiaLima(isoOrDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!isoOrDate || typeof isoOrDate !== 'string') {
    return false;
  }
  const trimmed = isoOrDate.trim();
  if (!trimmed) {
    return false;
  }
  const hoy = fechaHoyLima(now);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed === hoy;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return fechaLimaDesdeDate(parsed) === hoy;
}
