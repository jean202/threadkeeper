import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';
import NavBar from '@/components/NavBar';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';

export default function Home() {
  const { data, error, loading, failures, retrying, reload } = useAsyncResource(async () => {
    const [threads, readiness] = await Promise.all([
      threadKeeperClient.listThreads(),
      threadKeeperClient.getPortfolioReadiness(),
    ]);
    return { threads, readiness };
  });

  return (
    <div style={{ padding: '20px' }}>
      <NavBar current="/" />
      <h1>ThreadKeeper</h1>

      {error && (
        <LoadError error={error} failures={failures} retrying={retrying} onRetry={reload} />
      )}
      {loading && <p>Loading...</p>}

      {data && (
        <>
          <h2>Threads</h2>
          {data.threads.length === 0 ? (
            <p>No threads found</p>
          ) : (
            <ul>
              {data.threads.map((thread) => (
                <li key={thread.id}>
                  <Link href={`/threads/${thread.id}`}>{thread.title}</Link>{' '}
                  - {thread.status}
                  <PortfolioReadinessBadge readiness={data.readiness.get(thread.projectKey)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
