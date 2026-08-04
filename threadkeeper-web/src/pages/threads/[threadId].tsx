import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { ProviderType, ThreadDetailResponse } from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';
import DriftWarning from '@/components/DriftWarning';

const PROVIDERS: ProviderType[] = ['CLAUDE', 'CODEX', 'GEMINI', 'GPT'];

export default function ThreadDetail() {
  const router = useRouter();
  const { threadId } = router.query;
  const [thread, setThread] = useState<ThreadDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<PortfolioReadiness | undefined>(undefined);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [targetProvider, setTargetProvider] = useState<ProviderType>('CLAUDE');

  const loadThread = useCallback(async () => {
    const [data, readinessMap] = await Promise.all([
      threadKeeperClient.getThread(Number(threadId)),
      threadKeeperClient.getPortfolioReadiness(),
    ]);
    setThread(data);
    setReadiness(readinessMap.get(data.projectKey));
    setNextActionDraft(data.currentNextAction ?? '');
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;

    const load = async () => {
      try {
        await loadThread();
      } catch (err) {
        setError(describeApiError(err, 'Failed to load thread'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [threadId, loadThread]);

  /** Runs one mutation, then refetches so the page reflects server truth. */
  const runAction = async (name: string, action: () => Promise<unknown>) => {
    setBusy(name);
    setActionError(null);
    try {
      await action();
      await loadThread();
    } catch (err) {
      setActionError(describeApiError(err, `Failed to ${name}`));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!thread) return <div>Thread not found</div>;

  const latestHandoff = thread.handoffs.length > 0 ? thread.handoffs[0] : null;
  const id = thread.id;

  return (
    <div style={{ padding: '20px' }}>
      <Link href="/">← Back</Link>
      <h1>{thread.title}</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2>Overview</h2>
        <p><strong>Status:</strong> {thread.status}</p>
        <p><strong>Priority:</strong> {thread.priority}</p>
        <p>
          <strong>Drift:</strong>{' '}
          <DriftWarning driftStatus={thread.driftStatus} driftScore={thread.driftScore} />
        </p>
        {readiness && (
          <p><strong>Portfolio:</strong> <PortfolioReadinessBadge readiness={readiness} /></p>
        )}
        <p><strong>Created:</strong> {new Date(thread.createdAt).toLocaleDateString()}</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Goals & Context</h2>
        <p><strong>Original Intent:</strong> {thread.originalIntent}</p>
        <p><strong>Today's Goal:</strong> {thread.todayGoal ?? '—'}</p>
        <p><strong>Done Condition:</strong> {thread.doneCondition ?? '—'}</p>
        <p><strong>Next Action:</strong> {thread.currentNextAction ?? '—'}</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Actions</h2>
        {actionError && <p role="alert">Error: {actionError}</p>}

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="nextAction"><strong>Pin next action</strong></label>
          <textarea
            id="nextAction"
            value={nextActionDraft}
            onChange={(e) => setNextActionDraft(e.target.value)}
            maxLength={2000}
            rows={2}
            style={{ width: '100%', padding: '8px' }}
            placeholder="The one concrete thing to do when you come back"
          />
          <button
            onClick={() =>
              runAction('pin the next action', () =>
                threadKeeperClient.updateNextAction(id, nextActionDraft),
              )
            }
            disabled={busy !== null || nextActionDraft.trim() === ''}
          >
            {busy === 'pin the next action' ? 'Saving...' : 'Pin Next Action'}
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="progressNote"><strong>Add progress snapshot</strong></label>
          <textarea
            id="progressNote"
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '8px' }}
            placeholder="What changed since last time?"
          />
          <button
            onClick={() =>
              runAction('add the snapshot', async () => {
                await threadKeeperClient.createSnapshot(id, {
                  snapshotType: 'PROGRESS',
                  summary: progressNote,
                });
                setProgressNote('');
              })
            }
            disabled={busy !== null || progressNote.trim() === ''}
          >
            {busy === 'add the snapshot' ? 'Saving...' : 'Add Snapshot'}
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="targetProvider"><strong>Create handoff draft</strong></label>{' '}
          <select
            id="targetProvider"
            value={targetProvider}
            onChange={(e) => setTargetProvider(e.target.value as ProviderType)}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>{' '}
          <button
            onClick={() =>
              runAction('create the handoff draft', () =>
                threadKeeperClient.generateHandoffDraft(id, { targetProvider }),
              )
            }
            disabled={busy !== null}
          >
            {busy === 'create the handoff draft' ? 'Creating...' : 'Create Handoff'}
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => runAction('re-evaluate drift', () => threadKeeperClient.evaluateDrift(id))}
            disabled={busy !== null}
          >
            {busy === 're-evaluate drift' ? 'Evaluating...' : 'Re-evaluate Drift'}
          </button>
        </div>

        <div>
          <button
            onClick={() =>
              runAction('mark the thread completed', () =>
                threadKeeperClient.updateThreadStatus(id, 'COMPLETED'),
              )
            }
            disabled={busy !== null || thread.status === 'COMPLETED'}
          >
            {busy === 'mark the thread completed' ? 'Saving...' : 'Mark Completed'}
          </button>{' '}
          {thread.status !== 'ACTIVE' && (
            <button
              onClick={() =>
                runAction('reopen the thread', () => threadKeeperClient.updateThreadStatus(id, 'ACTIVE'))
              }
              disabled={busy !== null}
            >
              {busy === 'reopen the thread' ? 'Saving...' : 'Reopen'}
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Source Sessions ({thread.sourceSessions.length})</h2>
        {thread.sourceSessions.length === 0 ? (
          <p>No source sessions</p>
        ) : (
          <ul>
            {thread.sourceSessions.map((session) => (
              <li key={session.id}>
                {session.title ?? session.providerSessionKey} ({session.provider}
                {session.sourceType ? ` / ${session.sourceType}` : ''})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Snapshots ({thread.snapshots.length})</h2>
        {thread.snapshots.length === 0 ? (
          <p>No snapshots</p>
        ) : (
          <ul>
            {thread.snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                {snapshot.snapshotType} - {new Date(snapshot.createdAt).toLocaleString()}
                <div>{snapshot.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Handoff</h2>
        {!latestHandoff ? (
          <p>
            No handoff yet.{' '}
            <Link href={`/threads/${thread.id}/handoff`}>Create Draft</Link>
          </p>
        ) : (
          <div>
            <p><strong>Status:</strong> {latestHandoff.status}</p>
            <p><strong>Target Provider:</strong> {latestHandoff.targetProvider}</p>
            <p><strong>Reason:</strong> {latestHandoff.reason ?? '—'}</p>
            <p><strong>What Changed:</strong> {latestHandoff.whatChanged ?? '—'}</p>
            <p><strong>Blockers:</strong> {latestHandoff.blockers ?? '—'}</p>
            <p><strong>Next Action:</strong> {latestHandoff.nextAction ?? '—'}</p>
            <Link href={`/threads/${thread.id}/handoff`}>View/Edit Handoff</Link>
          </div>
        )}
      </section>

      <section>
        <h2>Notifications ({thread.notificationEvents.length})</h2>
        {thread.notificationEvents.length === 0 ? (
          <p>No notifications</p>
        ) : (
          <ul>
            {thread.notificationEvents.slice(0, 5).map((event) => (
              <li key={event.id}>
                {event.eventType} ({event.channel} / {event.deliveryStatus}) -{' '}
                {new Date(event.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
