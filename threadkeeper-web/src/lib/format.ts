/**
 * Display formatting shared across pages. These live together because the
 * pages had each grown their own copy, and the copies had already drifted:
 * some guarded a null timestamp and some did not.
 */

/** A timestamp with date and time. Null reads as "never", not as an error. */
export function formatTimestamp(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : 'never';
}

/** Just the date, for values where the time of day is noise. */
export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : '—';
}

/**
 * How long a thread has sat idle, in the largest unit that still reads
 * naturally. DashboardService sends Long.MAX_VALUE for threads that never
 * recorded activity, which is not a duration anyone wants rendered.
 */
export function formatStaleness(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes > 60 * 24 * 365) return 'no activity yet';
  if (minutes < 60) return `${minutes}m idle`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h idle`;
  return `${Math.floor(minutes / (60 * 24))}d idle`;
}
