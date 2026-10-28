/**
 * Calculates the start timestamp of the current hourly window
 */
export function getHourWindowStart(date = new Date()): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

/**
 * Calculates the start timestamp of the next hourly window
 */
export function getNextHourWindowStart(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

/**
 * Calculates remaining milliseconds in current hour window
 */
export function getRemainingMsInHour(date = new Date()): number {
  const nextHour = getNextHourWindowStart(date);
  return Math.max(0, nextHour.getTime() - date.getTime());
}

/**
 * Formats date into ISO string safely
 */
export function toIsoSafe(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return isNaN(d.getTime()) ? null : d.toISOString();
}
