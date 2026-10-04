import { retryDelayMs } from '@/lib/useAsyncResource';

/**
 * Shown while a load is failing. When the api is merely still booting the point
 * is to make clear that the page is still trying, so waiting is enough; when the
 * api answered and will not change its answer, only the manual retry is offered.
 */
/** Sent by the api as a 503 when Postgres cannot be reached. */
export const DATABASE_UNAVAILABLE = 'DATABASE_UNAVAILABLE';

export default function LoadError({
  error,
  code = null,
  failures,
  retrying,
  onRetry,
}: {
  error: string;
  /** The api's error code, when it sent one. */
  code?: string | null;
  failures: number;
  retrying: boolean;
  onRetry: () => void;
}) {
  const seconds = Math.round(retryDelayMs(failures) / 1000);
  // axios reports a refused connection with no response as exactly this.
  const refused = error === 'Network Error';
  // The api is up but Postgres is not -- in practice, Docker Desktop was quit.
  const databaseDown = code === DATABASE_UNAVAILABLE;

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
        {refused
          ? 'API 서버에 연결할 수 없어요.'
          : databaseDown
            ? '데이터베이스에 연결할 수 없어요.'
            : '이 페이지를 불러오지 못했어요.'}
      </strong>

      {databaseDown && (
        <p style={{ fontSize: '13px', color: '#666', margin: '6px 0 0' }}>
          데이터베이스(Postgres)는 Docker 안에서 돌아가요. Docker Desktop이 켜져 있고
          threadkeeper-postgres 컨테이너가 실행 중인지 확인해 주세요 (
          <code>docker compose up -d postgres</code>). 데이터베이스가 응답하면 이 페이지는
          저절로 채워져요.
        </p>
      )}

      {refused && (
        <p style={{ fontSize: '13px', color: '#666', margin: '6px 0 0' }}>
          방금 켰다면 API 서버가 아직 시작 중일 수 있어요. 서버가 응답하면 이 페이지는 저절로
          채워져요.
        </p>
      )}

      <p style={{ fontSize: '13px', color: '#666', margin: '6px 0 0' }}>
        {retrying ? `${seconds}초 뒤 다시 시도 (${failures}번 실패) · ` : ''}
        {error}
      </p>

      <button onClick={onRetry} style={{ marginTop: '10px' }}>
        지금 다시 시도
      </button>
    </div>
  );
}
