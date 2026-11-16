/**
 * Strictly parses positive integer entity identifiers returned by URL params,
 * storage payloads or legacy UI strings (e.g. "ord-42").
 * Rejects non-positive, NaN, decimal or non-numeric inputs by returning null
 * instead of silently defaulting to 0 or 1.
 */
export function parsePositiveIntId(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const stripped = trimmed.startsWith('ord-') ? trimmed.slice(4) : trimmed;
  if (!/^\d+$/.test(stripped)) {
    return null;
  }
  const parsed = Number(stripped);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isPositiveIntId(value: string | number | null | undefined): boolean {
  return parsePositiveIntId(value) !== null;
}
