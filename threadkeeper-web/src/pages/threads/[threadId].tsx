import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { ProviderType, ThreadDetailResponse } from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';
import DriftWarning from '@/components/DriftWarning';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { formatDate, formatTimestamp } from '@/lib/format';

const PROVIDERS: ProviderType[] = ['CLAUDE', 'CODEX', 'GEMINI', 'GPT'];

interface ThreadDetailData {
  thread: ThreadDetailResponse;
  readiness: PortfolioReadiness | undefined;
}

export default function ThreadDetail() {
  const router = useRouter();
  const { threadId } = router.query;

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // null means "not edited", so the field shows whatever the server last said.
  // Deriving it beats syncing it in an effect, which would cascade a render.
  const [nextActionEdit, setNextActionEdit] = useState<string | null>(null);
  const [progressNote, setProgressNote] = useState('');
  const [targetProvider, setTargetProvider] = useState<ProviderType>('CLAUDE');

  // Disabled until the router has filled in the dynamic param, so the hook does
  // not fire a request for thread "NaN".
  const resource = useAsyncResource<ThreadDetailData>(
    async () => {
      const [thread, readinessMap] = await Promise.all([
        threadKeeperClient.getThread(Number(threadId)),
        threadKeeperClient.getPortfolioReadiness(),
      ]);
      return { thread, readiness: readinessMap.get(thread.projectKey) };
    },
    [threadId],
    Boolean(threadId),
  );

  const thread = resource.data?.thread ?? null;
  const readiness = resource.data?.readiness;
  const nextActionDraft = nextActionEdit ?? thread?.currentNextAction ?? '';

  /** Runs one mutation, then refetches so the page reflects server truth. */
  const runAction = async (name: string, action: () => Promise<unknown>) => {
    setBusy(name);
    setActionError(null);
    try {
      await action();
      setNextActionEdit(null);
      resource.reload();
    } catch (err) {
      setActionError(describeApiError(err, `Failed to ${name}`));
    } finally {
      setBusy(null);
    }
  };

  if (resource.loading) return <div>Loading...</div>;
  if (!thread) {
    return (
      <div style={{ padding: '20px' }}>
        <LoadError
          error={resource.error ?? 'Thread not found'}
          failures={resource.failures}
          retrying={resource.retrying}
          onRetry={resource.reload}
        />
      </div>
    );
  }

  const latestHandoff = thread.handoffs.length > 0 ? thread.handoffs[0] : null;
  const id = thread.id;

  return (
    <div style={{ padding: '20px' }}>
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
        <p><strong>Created:</strong> {formatDate(thread.createdAt)}</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Goals & Context</h2>
        <p><strong>Original Intent:</strong> {thread.originalIntent}</p>
        <p><strong>Today&apos;s Goal:</strong> {thread.todayGoal ?? '—'}</p>
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
            onChange={(e) => setNextActionEdit(e.target.value)}
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
                {snapshot.snapshotType} - {formatTimestamp(snapshot.createdAt)}
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
                {formatTimestamp(event.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
