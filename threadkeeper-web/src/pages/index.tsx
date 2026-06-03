import { useEffect, useState } from 'react';
import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { ThreadResponse } from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';

export default function Home() {
  const [threads, setThreads] = useState<ThreadResponse[]>([]);
  const [readiness, setReadiness] = useState<Map<string, PortfolioReadiness>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [threadData, readinessData] = await Promise.all([
          threadKeeperClient.listThreads(),
          threadKeeperClient.getPortfolioReadiness(),
        ]);
        setThreads(threadData);
        setReadiness(readinessData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load threads');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>ThreadKeeper</h1>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/today" style={{ marginRight: '10px' }}>
          Today
        </Link>
      </div>
      <h2>Threads</h2>
      {threads.length === 0 ? (
        <p>No threads found</p>
      ) : (
        <ul>
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link href={`/threads/${thread.id}`}>{thread.title}</Link>{' '}
              - {thread.status}
              <PortfolioReadinessBadge readiness={readiness.get(thread.projectKey)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
