import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { ThreadResponse } from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';

interface HomeData {
  threads: ThreadResponse[];
  readiness: Map<string, PortfolioReadiness>;
}

export default function Home() {
  const resource = useAsyncResource<HomeData>(async () => {
    const [threads, readiness] = await Promise.all([
      threadKeeperClient.listThreads(),
      threadKeeperClient.getPortfolioReadiness(),
    ]);
    return { threads, readiness };
  });

  if (resource.loading) return <div>Loading...</div>;
  if (!resource.data) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>ThreadKeeper</h1>
        <LoadError
          error={resource.error ?? 'Failed to load threads'}
          failures={resource.failures}
          retrying={resource.retrying}
          onRetry={resource.reload}
        />
      </div>
    );
  }

  const { threads, readiness } = resource.data;

  return (
    <div style={{ padding: '20px' }}>
      <h1>ThreadKeeper</h1>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/today" style={{ marginRight: '10px' }}>
          Today
        </Link>
        <Link href="/threads/new" style={{ marginRight: '10px' }}>
          New Thread
        </Link>
        <Link href="/settings/notifications" style={{ marginRight: '10px' }}>
          Notifications
        </Link>
        <Link href="/settings/providers">Providers</Link>
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
