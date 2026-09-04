import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { TodayDashboardResponse } from '@/types/dashboard';
import DashboardThreadList from '@/components/DashboardThreadList';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { formatStaleness } from '@/lib/format';
import { resumeReasonLabel } from '@/components/DashboardThreadList';

export default function Today() {
  const resource = useAsyncResource<TodayDashboardResponse>(() =>
    threadKeeperClient.getTodayDashboard(),
  );
  const dashboard = resource.data;

  if (resource.loading) return <div>Loading today&apos;s dashboard...</div>;
  if (!dashboard) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Today</h1>
        <LoadError
          error={resource.error ?? 'Failed to load the dashboard'}
          failures={resource.failures}
          retrying={resource.retrying}
          onRetry={resource.reload}
        />
      </div>
    );
  }

  // The server ranks by priority, drift, and staleness and sends ids; the first
  // one is the thread to resume if you only have time for one. Every id in the
  // ranking appears in activeThreads, but resolve defensively rather than
  // rendering a blank card if that ever stops holding.
  const topRankedId = dashboard.recommendedOrder[0] ?? null;
  const continueNow =
    topRankedId === null
      ? null
      : (dashboard.activeThreads.find((thread) => thread.threadId === topRankedId) ?? null);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Today</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2>Continue Now</h2>
        {!continueNow ? (
          <p>Nothing active to resume.</p>
        ) : (
          <div>
            <Link href={`/threads/${continueNow.threadId}`}>
              <strong>{continueNow.title}</strong>
            </Link>
            <p>
              Why: {resumeReasonLabel(continueNow.resumeReason)} ·{' '}
              {formatStaleness(continueNow.staleMinutes)}
            </p>
            <p>Next action: {continueNow.nextAction ?? '— not set —'}</p>
          </div>
        )}
      </section>

      <DashboardThreadList title="Active" threads={dashboard.activeThreads} />
      <DashboardThreadList title="Stale" threads={dashboard.staleThreads} />
      <DashboardThreadList title="Blocked" threads={dashboard.blockedThreads} />
      <DashboardThreadList title="Completed Today" threads={dashboard.completedToday} />
    </div>
  );
}
