import { useState } from 'react';
import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { ThreadResponse, ThreadSearchParams } from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';
import ThreadSearchForm from '@/components/ThreadSearchForm';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';

interface HomeData {
  threads: ThreadResponse[];
  readiness: Map<string, PortfolioReadiness>;
  /** Which filters produced this list, so a stale result is recognisable. */
  params: ThreadSearchParams;
}

const NO_FILTERS: ThreadSearchParams = {};

export default function Home() {
  // Held as one object so the identity only changes when a search is submitted;
  // the hook restarts its request on exactly that change.
  const [search, setSearch] = useState<ThreadSearchParams>(NO_FILTERS);
  // Which filters the current error belongs to. The hook keeps an error on
  // screen until the next attempt settles, so without this a fresh search would
  // briefly inherit the failure of the one before it.
  const [failedSearch, setFailedSearch] = useState<ThreadSearchParams | null>(null);

  const resource = useAsyncResource<HomeData>(async () => {
    try {
      const [threads, readiness] = await Promise.all([
        threadKeeperClient.listThreads(search),
        threadKeeperClient.getPortfolioReadiness(),
      ]);
      return { threads, readiness, params: search };
    } catch (err) {
      setFailedSearch(search);
      throw err;
    }
  }, [search]);

  // The list on screen still belongs to the previous filters until the new
  // request settles. Showing it beats flashing an empty page -- but once that
  // request has failed, the failure has to be shown too, or the button sits on
  // "Searching..." forever while the retries (or a final 4xx) go unseen.
  const stale = resource.data !== null && resource.data.params !== search;
  const searchFailed = stale && resource.error !== null && failedSearch === search;
  const searching = stale && !searchFailed;
  const filtered = Object.values(search).some((value) => value !== undefined);

  const loaded = resource.data;
  const results = !loaded ? null : loaded.threads.length === 0 ? (
    <p>{filtered ? 'No threads match these filters.' : 'No threads found'}</p>
  ) : (
    <ul>
      {loaded.threads.map((thread) => (
        <li key={thread.id}>
          <Link href={`/threads/${thread.id}`}>{thread.title}</Link> - {thread.status}
          <PortfolioReadinessBadge readiness={loaded.readiness.get(thread.projectKey)} />
        </li>
      ))}
    </ul>
  );

  return (
    <div style={{ padding: '20px' }}>
      <h1>ThreadKeeper</h1>
      <h2>Threads</h2>
      <ThreadSearchForm onSearch={setSearch} busy={searching} />

      {resource.loading && <div>Loading...</div>}
      {!resource.loading && (!resource.data || searchFailed) && (
        <LoadError
          error={resource.error ?? 'Failed to load threads'}
          failures={resource.failures}
          retrying={resource.retrying}
          onRetry={resource.reload}
        />
      )}
      {results}
    </div>
  );
}
