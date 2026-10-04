/**
 * Display formatting shared across pages. These live together because the
 * pages had each grown their own copy, and the copies had already drifted:
 * some guarded a null timestamp and some did not.
 */

/** A timestamp with date and time. Null reads as "none yet", not as an error. */
export function formatTimestamp(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('ko-KR') : '없음';
}

/** Just the date, for values where the time of day is noise. */
export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('ko-KR') : '—';
}

/**
 * How long a thread has sat idle, in the largest unit that still reads
 * naturally. DashboardService sends Long.MAX_VALUE for threads that never
 * recorded activity, which is not a duration anyone wants rendered.
 */
export function formatStaleness(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes > 60 * 24 * 365) return '아직 활동 없음';
  if (minutes < 60) return `${minutes}분째 멈춤`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간째 멈춤`;
  return `${Math.floor(minutes / (60 * 24))}일째 멈춤`;
}
