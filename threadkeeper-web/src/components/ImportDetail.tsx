import { useState } from 'react';
import Link from 'next/link';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { LatestImportResponse } from '@/types/settings';
import { formatTimestamp } from '@/lib/format';

/**
 * The connection stamps its own timestamp after the rows are written, so the
 * two are always a few milliseconds apart even on a run that imported plenty.
 * Only a real gap means the last run found nothing new.
 */
const SAME_RUN_TOLERANCE_MS = 60_000;

function broughtNothingNew(detail: LatestImportResponse): boolean {
  if (!detail.lastImportAt) return false;
  if (!detail.latestSessionImportedAt) return true;
  const gap =
    new Date(detail.lastImportAt).getTime() -
    new Date(detail.latestSessionImportedAt).getTime();
  return gap > SAME_RUN_TOLERANCE_MS;
}

/**
 * Ingestion status for one connection, fetched only when opened -- the list
 * would otherwise fire one request per connection just to render.
 */
export default function ImportDetail({ connectionId }: { connectionId: number }) {
  const [detail, setDetail] = useState<LatestImportResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await threadKeeperClient.getLatestImport(connectionId));
    } catch (err) {
      setError(describeApiError(err, '가져오기 상세를 불러오지 못했어요'));
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // Refetch on each open: an import may have run since it was last seen.
    if (next) load();
  };

  return (
    <div>
      <button onClick={toggle} aria-expanded={open}>
        {open ? '가져오기 상세 닫기' : '가져오기 상세'}
      </button>
      {open && (
        <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid #ddd' }}>
          {loading && <p>불러오는 중...</p>}
          {error && <p role="alert">오류: {error}</p>}
          {detail && !loading && (
            <>
              <div>연결된 스레드: {detail.linkedThreadCount}개</div>
              <div>가져온 세션: {detail.importedSessionCount}개</div>
              <div>마지막 실행: {formatTimestamp(detail.lastImportAt)}</div>
              <div>
                마지막으로 새 내용이 들어온 때: {formatTimestamp(detail.latestSessionImportedAt)}
                {broughtNothingNew(detail) && ' — 마지막 실행에서는 새로 가져온 게 없어요'}
              </div>
              {detail.recentSessions.length === 0 ? (
                <p>아직 가져온 세션이 없어요.</p>
              ) : (
                <>
                  <div>최근 세션:</div>
                  <ul>
                    {detail.recentSessions.map((session) => (
                      <li key={session.id}>
                        {session.title ?? session.providerSessionKey} —{' '}
                        {formatTimestamp(session.importedAt)}
                        {session.threadId !== null && (
                          <>
                            {' '}
                            <Link href={`/threads/${session.threadId}`}>
                              스레드 {session.threadId}
                            </Link>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
