import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { ThreadDetailResponse, HandoffResponse } from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';

export default function ThreadDetail() {
  const router = useRouter();
  const { threadId } = router.query;
  const [thread, setThread] = useState<ThreadDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<PortfolioReadiness | undefined>(undefined);

  useEffect(() => {
    if (!threadId) return;

    const loadThread = async () => {
      try {
        const [data, readinessMap] = await Promise.all([
          threadKeeperClient.getThread(Number(threadId)),
          threadKeeperClient.getPortfolioReadiness(),
        ]);
        setThread(data);
        setReadiness(readinessMap.get(data.projectKey));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load thread');
      } finally {
        setLoading(false);
      }
    };

    loadThread();
  }, [threadId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!thread) return <div>Thread not found</div>;

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
                {snapshot.snapshotType} - {new Date(snapshot.createdAt).toLocaleString()}
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
            <p><strong>Draft:</strong> {latestHandoff.draftContent.substring(0, 100)}...</p>
            {latestHandoff.finalContent && (
              <p><strong>Final:</strong> {latestHandoff.finalContent.substring(0, 100)}...</p>
            )}
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
                {event.ruleType} - {new Date(event.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
