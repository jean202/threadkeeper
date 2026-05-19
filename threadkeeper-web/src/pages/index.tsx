import { useEffect, useState } from 'react';
import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { ThreadResponse } from '@/types/thread';

export default function Home() {
  const [threads, setThreads] = useState<ThreadResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadThreads = async () => {
      try {
        const data = await threadKeeperClient.listThreads();
        setThreads(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load threads');
      } finally {
        setLoading(false);
      }
    };

    loadThreads();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>ThreadKeeper</h1>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/today">
          <a style={{ marginRight: '10px' }}>Today</a>
        </Link>
      </div>
      <h2>Threads</h2>
      {threads.length === 0 ? (
        <p>No threads found</p>
      ) : (
        <ul>
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link href={`/threads/${thread.id}`}>
                <a>{thread.title}</a>
              </Link>{' '}
              - {thread.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
