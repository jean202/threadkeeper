import { describe, expect, it } from 'vitest';
import { describeApiError } from '@/api/client';

function axiosError(data: unknown) {
  return Object.assign(new Error('Request failed with status code 400'), {
    isAxiosError: true,
    response: { data },
  });
}

describe('describeApiError', () => {
  it('prefers the API message over the generic axios one', () => {
    const message = describeApiError(
      axiosError({ code: 'THREAD_NOT_FOUND', message: 'The requested thread does not exist.', fieldErrors: null }),
      'fallback',
    );

    expect(message).toBe('The requested thread does not exist.');
  });

  it('includes per-field validation reasons, which is the useful part of a 400', () => {
    const message = describeApiError(
      axiosError({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        fieldErrors: [
          { field: 'targetProvider', reason: 'must not be null' },
          { field: 'reason', reason: 'size must be between 0 and 100' },
        ],
      }),
      'fallback',
    );

    expect(message).toContain('targetProvider: must not be null');
    expect(message).toContain('reason: size must be between 0 and 100');
  });

  it('falls back to the axios message when the response carries no body', () => {
    const error = Object.assign(new Error('Network Error'), { isAxiosError: true, response: undefined });

    expect(describeApiError(error, 'fallback')).toBe('Network Error');
  });

  it('handles a plain Error', () => {
    expect(describeApiError(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('uses the fallback for something that is not an error at all', () => {
    expect(describeApiError('nonsense', 'fallback')).toBe('fallback');
  });
});
