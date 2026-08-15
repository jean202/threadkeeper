import { retryDelayMs } from '@/lib/useAsyncResource';

/**
 * Shown while a load is failing. When the api is merely still booting the point
 * is to make clear that the page is still trying, so waiting is enough; when the
 * api answered with a 4xx there is nothing to wait for and only the manual retry
 * is offered.
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
  const refused = error === 'Network Error';

  return (
    <div
      style={{
        margin: '10px 0',
        padding: '12px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '4px',
      }}
    >
      <strong style={{ color: '#b91c1c' }}>
        {refused ? 'API 서버에 연결하지 못했습니다.' : '데이터를 불러오지 못했습니다.'}
      </strong>

      {refused && (
        <p style={{ fontSize: '13px', color: '#666', margin: '6px 0 0' }}>
          부팅 직후라면 API가 아직 올라오는 중일 수 있습니다. 준비되면 자동으로 표시됩니다.
        </p>
      )}

      <p style={{ fontSize: '13px', color: '#666', margin: '6px 0 0' }}>
        {retrying ? `${seconds}초 후 다시 시도합니다. (실패 ${failures}회) · ` : ''}
        {error}
      </p>

      <button onClick={onRetry} style={{ marginTop: '10px' }}>
        지금 다시 시도
      </button>
    </div>
  );
}
