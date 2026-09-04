import { describe, expect, it } from 'vitest';
import { formatDate, formatStaleness, formatTimestamp } from '@/lib/format';

describe('formatTimestamp', () => {
  it('renders a real timestamp', () => {
    expect(formatTimestamp('2026-08-04T04:19:27Z')).toBe(
      new Date('2026-08-04T04:19:27Z').toLocaleString(),
    );
  });

  // The pages that inlined this had drifted: some guarded null, some did not.
  it('reads null as never rather than "Invalid Date"', () => {
    expect(formatTimestamp(null)).toBe('never');
    expect(formatTimestamp(undefined)).toBe('never');
  });
});

describe('formatDate', () => {
  it('drops the time of day', () => {
    expect(formatDate('2026-08-04T04:19:27Z')).toBe(
      new Date('2026-08-04T04:19:27Z').toLocaleDateString(),
    );
  });

  it('has its own placeholder, since a missing date is not "never"', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatStaleness', () => {
  it('uses minutes below an hour', () => {
    expect(formatStaleness(0)).toBe('0m idle');
    expect(formatStaleness(59)).toBe('59m idle');
  });

  it('switches to hours, then to days', () => {
    expect(formatStaleness(60)).toBe('1h idle');
    expect(formatStaleness(480)).toBe('8h idle');
    expect(formatStaleness(60 * 24)).toBe('1d idle');
    expect(formatStaleness(60 * 24 * 3)).toBe('3d idle');
  });

  /**
   * DashboardService sends Long.MAX_VALUE for a thread that never recorded
   * activity. Rendering that as a duration would read as millions of days.
   */
  it('reports never-touched threads instead of an absurd duration', () => {
    expect(formatStaleness(Number.MAX_SAFE_INTEGER)).toBe('no activity yet');
    expect(formatStaleness(Infinity)).toBe('no activity yet');
    expect(formatStaleness(NaN)).toBe('no activity yet');
  });
});
