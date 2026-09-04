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
      setError(describeApiError(err, 'Failed to load import details'));
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
        {open ? 'Hide import details' : 'Import details'}
      </button>
      {open && (
        <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid #ddd' }}>
          {loading && <p>Loading import details...</p>}
          {error && <p role="alert">Error: {error}</p>}
          {detail && !loading && (
            <>
              <div>Linked threads: {detail.linkedThreadCount}</div>
              <div>Sessions imported: {detail.importedSessionCount}</div>
              <div>Last run attempted: {formatTimestamp(detail.lastImportAt)}</div>
              <div>
                Content last arrived: {formatTimestamp(detail.latestSessionImportedAt)}
                {broughtNothingNew(detail) && ' — the last run brought nothing new'}
              </div>
              {detail.recentSessions.length === 0 ? (
                <p>No sessions imported yet.</p>
              ) : (
                <>
                  <div>Most recent sessions:</div>
                  <ul>
                    {detail.recentSessions.map((session) => (
                      <li key={session.id}>
                        {session.title ?? session.providerSessionKey} —{' '}
                        {formatTimestamp(session.importedAt)}
                        {session.threadId !== null && (
                          <>
                            {' '}
                            <Link href={`/threads/${session.threadId}`}>
                              thread {session.threadId}
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
