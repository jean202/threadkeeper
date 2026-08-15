import { useRouter } from 'next/router';
import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';

export default function ThreadDetail() {
  const router = useRouter();
  const { threadId } = router.query;
  // router.query is empty on the very first render of a dynamic route.
  const ready = typeof threadId === 'string';

  const { data, error, loading, failures, retrying, reload } = useAsyncResource(
    async () => {
      const [thread, readinessMap] = await Promise.all([
        threadKeeperClient.getThread(Number(threadId)),
        threadKeeperClient.getPortfolioReadiness(),
      ]);
      return { thread, readiness: readinessMap.get(thread.projectKey) };
    },
    [threadId],
    ready,
  );

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Link href="/">← Back</Link>
        <LoadError error={error} failures={failures} retrying={retrying} onRetry={reload} />
      </div>
    );
  }

  if (loading || !data) return <div style={{ padding: '20px' }}>Loading...</div>;

  const { thread, readiness } = data;
  const latestHandoff = thread.handoffs.length > 0 ? thread.handoffs[0] : null;

  return (
    <div style={{ padding: '20px' }}>
      <Link href="/">← Back</Link>
      <h1>{thread.title}</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2>Overview</h2>
        <p><strong>Status:</strong> {thread.status}</p>
        <p><strong>Priority:</strong> {thread.priority}</p>
        <p><strong>Drift Status:</strong> {thread.driftStatus}</p>
        {readiness && (
          <p><strong>Portfolio:</strong> <PortfolioReadinessBadge readiness={readiness} /></p>
        )}
        <p><strong>Created:</strong> {new Date(thread.createdAt).toLocaleDateString()}</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Goals & Context</h2>
        <p><strong>Original Intent:</strong> {thread.originalIntent}</p>
        <p><strong>Today's Goal:</strong> {thread.todayGoal}</p>
        <p><strong>Done Condition:</strong> {thread.doneCondition}</p>
        <p><strong>Next Action:</strong> {thread.currentNextAction}</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Source Sessions ({thread.sourceSessions.length})</h2>
        {thread.sourceSessions.length === 0 ? (
          <p>No source sessions</p>
        ) : (
          <ul>
            {thread.sourceSessions.map((session) => (
              <li key={session.id}>
                {session.title} ({session.sourceType})
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
                <div>
                  {snapshot.snapshotType} - {new Date(snapshot.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: '4px' }}>{snapshot.summary}</div>
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
            <p><strong>What Changed:</strong> {latestHandoff.whatChanged || '-'}</p>
            <p><strong>Blockers:</strong> {latestHandoff.blockers || '-'}</p>
            <p><strong>Next Action:</strong> {latestHandoff.nextAction || '-'}</p>
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
                {event.eventType} · {event.channel} · {event.deliveryStatus} -{' '}
                {new Date(event.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
