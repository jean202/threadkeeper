import { describe, expect, it } from 'vitest';
import { formatDate, formatStaleness, formatTimestamp } from '@/lib/format';

describe('formatTimestamp', () => {
  it('renders a real timestamp', () => {
    expect(formatTimestamp('2026-08-04T04:19:27Z')).toBe(
      new Date('2026-08-04T04:19:27Z').toLocaleString('ko-KR'),
    );
  });

  // The pages that inlined this had drifted: some guarded null, some did not.
  it('reads null as "none yet" rather than "Invalid Date"', () => {
    expect(formatTimestamp(null)).toBe('없음');
    expect(formatTimestamp(undefined)).toBe('없음');
  });
});

describe('formatDate', () => {
  it('drops the time of day', () => {
    expect(formatDate('2026-08-04T04:19:27Z')).toBe(
      new Date('2026-08-04T04:19:27Z').toLocaleDateString('ko-KR'),
    );
  });

  it('has its own placeholder, since a missing date is not "never"', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatStaleness', () => {
  it('uses minutes below an hour', () => {
    expect(formatStaleness(0)).toBe('0분째 멈춤');
    expect(formatStaleness(59)).toBe('59분째 멈춤');
  });

  it('switches to hours, then to days', () => {
    expect(formatStaleness(60)).toBe('1시간째 멈춤');
    expect(formatStaleness(480)).toBe('8시간째 멈춤');
    expect(formatStaleness(60 * 24)).toBe('1일째 멈춤');
    expect(formatStaleness(60 * 24 * 3)).toBe('3일째 멈춤');
  });

  /**
   * DashboardService sends Long.MAX_VALUE for a thread that never recorded
   * activity. Rendering that as a duration would read as millions of days.
   */
  it('reports never-touched threads instead of an absurd duration', () => {
    expect(formatStaleness(Number.MAX_SAFE_INTEGER)).toBe('아직 활동 없음');
    expect(formatStaleness(Infinity)).toBe('아직 활동 없음');
    expect(formatStaleness(NaN)).toBe('아직 활동 없음');
  });
});
