import { useEffect, useState } from 'react';
import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { ThreadResponse } from '@/types/thread';

export default function Today() {
  const [threads, setThreads] = useState<ThreadResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadThreads = async () => {
      try {
        const data = await threadKeeperClient.listThreads();
        setThreads(data.filter((t) => t.status !== 'COMPLETED'));
      } finally {
        setLoading(false);
      }
    };

    loadThreads();
  }, []);

  if (loading) return <div>Loading today's threads...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <Link href="/">← Back</Link>
      <h1>Today</h1>
      <div style={{ marginTop: '20px' }}>
        {threads.length === 0 ? (
          <p>No active threads</p>
        ) : (
          <ul>
            {threads.map((thread) => (
              <li key={thread.id} style={{ marginBottom: '10px' }}>
                <div>
                  <strong>{thread.title}</strong>
                  <p>Today Goal: {thread.todayGoal || 'N/A'}</p>
                  <p>Next Action: {thread.currentNextAction || 'N/A'}</p>
                  <Link href={`/threads/${thread.id}`}>View Details</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
