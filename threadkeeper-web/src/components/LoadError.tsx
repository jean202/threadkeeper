import { retryDelayMs } from '@/lib/useAsyncResource';

/**
 * Shown while a load is failing. When the api is merely still booting the point
 * is to make clear that the page is still trying, so waiting is enough; when the
 * api answered and will not change its answer, only the manual retry is offered.
 */
export default function LoadError({
  error,
  failures,
  retrying,
  onRetry,
}: {
  error: string;
  failures: number;
  retrying: boolean;
  onRetry: () => void;
}) {
  const seconds = Math.round(retryDelayMs(failures) / 1000);
  // axios reports a refused connection with no response as exactly this.
  const refused = error === 'Network Error';

  return (
    <div
      role="alert"
      style={{
        margin: '10px 0',
        padding: '12px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '4px',
      }}
    >
      <strong style={{ color: '#b91c1c' }}>
        {refused ? 'Could not reach the API.' : 'Could not load this page.'}
      </strong>

      {refused && (
        <p style={{ fontSize: '13px', color: '#666', margin: '6px 0 0' }}>
          If you have just started everything, the API may still be booting. This page will fill in
          on its own once it answers.
        </p>
      )}

      <p style={{ fontSize: '13px', color: '#666', margin: '6px 0 0' }}>
        {retrying ? `Retrying in ${seconds}s (${failures} failed) · ` : ''}
        {error}
      </p>

      <button onClick={onRetry} style={{ marginTop: '10px' }}>
        Retry now
      </button>
    </div>
  );
}
