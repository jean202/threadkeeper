import axios from 'axios';
import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

/**
 * On a cold boot the LaunchAgents race each other: `next dev` answers on :3000
 * within seconds and the browser agent opens the dashboard immediately, but the
 * api needs another 30-70s (docker -> postgres -> gradle). Every request in that
 * window is refused, and a one-shot load leaves the tab stuck on "Network Error"
 * until someone reloads by hand. Retrying with backoff lets the page heal itself
 * the moment the api finally answers.
 */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];

/** Delay before the attempt that follows `failures` consecutive failures. */
export function retryDelayMs(failures: number): number {
  const index = Math.min(Math.max(failures - 1, 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

/**
 * A 4xx means the api answered and the answer will not change on its own, so a
 * missing thread must not spin forever. Anything without a response -- refused
 * connection, timeout, dns -- is exactly the boot-time case worth waiting out.
 */
export function isRetryable(err: unknown): boolean {
  if (axios.isAxiosError(err) && err.response) {
    return err.response.status >= 500;
  }
  return true;
}

/**
 * The machine-readable `code` from an ApiErrorResponse body, when the api sent
 * one. Lets a page tell "the database is down" from any other failure.
 */
export function apiErrorCode(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const code = (err.response?.data as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string') return code;
  }
  return null;
}

export interface AsyncResource<T> {
  data: T | null;
  error: string | null;
  /** The api's error code for `error`, if it gave one. */
  errorCode: string | null;
  /** Nothing has settled yet, so there is nothing at all to render. */
  loading: boolean;
  /** Consecutive failures. Drives both the backoff and the retry notice. */
  failures: number;
  /** Another attempt is scheduled. False once an error turns out to be final. */
  retrying: boolean;
  /** Drops any pending retry and starts over immediately. */
  reload: () => void;
}

/**
 * Loads a value, retrying with backoff until it succeeds.
 *
 * `load` may be an inline closure -- it is read through a ref, so only `deps`
 * (and `reload`) restart the request. Pass `enabled: false` while the inputs are
 * still unknown, e.g. before the router has filled in a dynamic route param.
 */
export function useAsyncResource<T>(
  load: () => Promise<T>,
  deps: DependencyList = [],
  enabled = true,
): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [generation, setGeneration] = useState(0);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const run = async () => {
      try {
        const result = await loadRef.current();
        if (cancelled) return;
        attempt = 0;
        setData(result);
        setError(null);
        setErrorCode(null);
        setFailures(0);
        setRetrying(false);
      } catch (err) {
        if (cancelled) return;
        attempt += 1;
        setError(err instanceof Error ? err.message : '요청에 실패했어요');
        setErrorCode(apiErrorCode(err));
        setFailures(attempt);

        if (isRetryable(err)) {
          setRetrying(true);
          timer = setTimeout(run, retryDelayMs(attempt));
        } else {
          setRetrying(false);
        }
      }
    };

    // No state is reset here on purpose: a synchronous setState inside an
    // effect cascades an extra render, and every field is overwritten when the
    // attempt settles anyway. A manual retry therefore keeps the previous error
    // on screen until the new attempt resolves, rather than flashing back to
    // the loading state.
    run();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, enabled, ...deps]);

  const reload = useCallback(() => setGeneration((current) => current + 1), []);

  return {
    data,
    error,
    errorCode,
    loading: data === null && error === null,
    failures,
    retrying,
    reload,
  };
}
