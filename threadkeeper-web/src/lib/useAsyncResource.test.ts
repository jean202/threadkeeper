import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * Lets the pending promise settle and React flush the resulting render.
 * vitest's own waitFor does not wrap updates in act, which makes these tests
 * noisy even when they pass.
 */
async function settle() {
  await act(async () => {});
}
import { isRetryable, retryDelayMs, useAsyncResource } from '@/lib/useAsyncResource';

/** axios shapes a refused connection as an error with no response. */
function refused() {
  return Object.assign(new Error('Network Error'), { isAxiosError: true, response: undefined });
}

function httpError(status: number) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: {} },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('retryDelayMs', () => {
  it('backs off and then holds at the longest delay', () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelayMs)).toEqual([1000, 2000, 4000, 8000, 15000, 30000]);
    // Waiting longer than 30s would make a recovered API feel dead.
    expect(retryDelayMs(20)).toBe(30000);
  });

  it('treats a zeroth failure as the first delay rather than indexing out of range', () => {
    expect(retryDelayMs(0)).toBe(1000);
  });
});

describe('isRetryable', () => {
  it('retries when the API never answered -- the boot-time case', () => {
    expect(isRetryable(refused())).toBe(true);
  });

  it('does not retry a 4xx, because that answer will not change on its own', () => {
    expect(isRetryable(httpError(404))).toBe(false);
    expect(isRetryable(httpError(400))).toBe(false);
  });

  it('retries a 5xx', () => {
    expect(isRetryable(httpError(500))).toBe(true);
    expect(isRetryable(httpError(503))).toBe(true);
  });
});

describe('useAsyncResource', () => {
  it('recovers on its own once the API starts answering', async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockRejectedValueOnce(refused())
      .mockRejectedValueOnce(refused())
      .mockResolvedValue('ready');

    const { result } = renderHook(() => useAsyncResource(load));

    // First failure: the page reports it is still trying.
    await settle();
    expect(result.current.failures).toBe(1);
    expect(result.current.retrying).toBe(true);
    expect(result.current.error).toBe('Network Error');
    expect(result.current.data).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.failures).toBe(2);

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.data).toBe('ready');

    // A recovery clears the error state rather than leaving a stale notice.
    expect(result.current.error).toBeNull();
    expect(result.current.failures).toBe(0);
    expect(result.current.retrying).toBe(false);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('gives up on a 4xx instead of spinning forever', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(httpError(404));

    const { result } = renderHook(() => useAsyncResource(load));

    await settle();
    expect(result.current.failures).toBe(1);
    expect(result.current.retrying).toBe(false);

    // A missing thread must not keep hammering the API.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reports loading only until something settles', async () => {
    const load = vi.fn().mockResolvedValue('ready');
    const { result } = renderHook(() => useAsyncResource(load));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('ready'));
    expect(result.current.loading).toBe(false);
  });

  it('stops being "loading" once an error arrives, so the page can show it', async () => {
    const load = vi.fn().mockRejectedValue(httpError(404));
    const { result } = renderHook(() => useAsyncResource(load));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.loading).toBe(false);
  });

  it('does not fire while disabled, then loads when enabled', async () => {
    const load = vi.fn().mockResolvedValue('ready');
    const { result, rerender } = renderHook(
      ({ enabled }) => useAsyncResource(load, [], enabled),
      { initialProps: { enabled: false } },
    );

    expect(load).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toBe('ready'));
  });

  it('reload starts a fresh attempt', async () => {
    const load = vi.fn().mockResolvedValue('ready');
    const { result } = renderHook(() => useAsyncResource(load));

    await waitFor(() => expect(result.current.data).toBe('ready'));
    act(() => result.current.reload());
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('drops a pending retry when the component unmounts', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(refused());
    const { result, unmount } = renderHook(() => useAsyncResource(load));

    await settle();
    expect(result.current.retrying).toBe(true);
    unmount();

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    // Still just the initial attempt: the scheduled retry was cleared.
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('re-runs when a dependency changes, e.g. the route param', async () => {
    const load = vi.fn().mockResolvedValue('ready');
    const { rerender } = renderHook(({ id }) => useAsyncResource(load, [id]), {
      initialProps: { id: 1 },
    });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender({ id: 2 });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('reads the latest load closure without restarting the request', async () => {
    const first = vi.fn().mockResolvedValue('first');
    const second = vi.fn().mockResolvedValue('second');
    const { result, rerender } = renderHook(({ load }) => useAsyncResource(load), {
      initialProps: { load: first },
    });

    await waitFor(() => expect(result.current.data).toBe('first'));

    // Swapping an inline closure must not by itself trigger a reload.
    rerender({ load: second });
    expect(second).not.toHaveBeenCalled();

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('second'));
  });
});
