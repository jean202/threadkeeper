import { describe, expect, it } from 'vitest';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { describeApiError, ThreadKeeperClient } from '@/api/client';

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

/**
 * Swaps in a fake adapter so the request is built by the real axios -- the
 * point of these tests is what actually reaches the wire, not what the client
 * intended to send.
 */
function captureRequests(client: ThreadKeeperClient) {
  const sent: AxiosRequestConfig[] = [];
  const instance = (client as unknown as { client: AxiosInstance }).client;
  instance.defaults.adapter = async (config) => {
    sent.push(config);
    return { data: [], status: 200, statusText: 'OK', headers: {}, config };
  };
  return sent;
}

/** The query string axios produced, without the leading path. */
function queryOf(config: AxiosRequestConfig): string {
  const params = new URLSearchParams(config.params as Record<string, string>);
  return params.toString();
}

describe('listThreads query building', () => {
  it('asks for the plain list when no filters are given', async () => {
    const client = new ThreadKeeperClient('http://127.0.0.1:8080/api/v1');
    const sent = captureRequests(client);

    await client.listThreads();

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/threads');
    expect(queryOf(sent[0])).toBe('');
  });

  it('uses the parameter names the controller declares', async () => {
    const client = new ThreadKeeperClient('http://127.0.0.1:8080/api/v1');
    const sent = captureRequests(client);

    await client.listThreads({
      q: 'drift',
      projectKey: 'threadkeeper',
      provider: 'CODEX',
      status: 'ACTIVE',
      priority: 'HIGH',
      activeWithinDays: 7,
    });

    const query = queryOf(sent[0]);
    expect(query).toContain('q=drift');
    expect(query).toContain('projectKey=threadkeeper');
    expect(query).toContain('provider=CODEX');
    expect(query).toContain('status=ACTIVE');
    expect(query).toContain('priority=HIGH');
    expect(query).toContain('activeWithinDays=7');
  });

  it('drops undefined and blank filters instead of sending them empty', async () => {
    const client = new ThreadKeeperClient('http://127.0.0.1:8080/api/v1');
    const sent = captureRequests(client);

    await client.listThreads({
      q: '   ',
      projectKey: '',
      provider: undefined,
      status: 'BLOCKED',
    });

    // A blank projectKey on the wire would filter for threads whose key is "",
    // which matches nothing -- exactly the bug this drops.
    expect(queryOf(sent[0])).toBe('status=BLOCKED');
  });
});
