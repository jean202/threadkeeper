import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { DashboardThread, TodayDashboardResponse } from '@/types/dashboard';
import DriftWarning from '@/components/DriftWarning';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';

const RESUME_REASON_LABEL: Record<DashboardThread['resumeReason'], string> = {
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
  DRIFTING: 'Drifting from original intent',
  STALE: 'Untouched for a while',
  MISSING_NEXT_ACTION: 'No next action recorded',
  HIGH_PRIORITY: 'High priority',
  READY: 'Ready to continue',
};

function formatStaleness(minutes: number): string {
  // DashboardService sends Long.MAX_VALUE for threads that never recorded activity.
  if (!Number.isFinite(minutes) || minutes > 60 * 24 * 365) return 'no activity yet';
  if (minutes < 60) return `${minutes}m idle`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h idle`;
  return `${Math.floor(minutes / (60 * 24))}d idle`;
}

function ThreadRow({ thread }: { thread: DashboardThread }) {
  return (
    <li style={{ marginBottom: '12px' }}>
      <Link href={`/threads/${thread.threadId}`}>
        <strong>{thread.title}</strong>
      </Link>{' '}
      <span>
        [{thread.priority}] {RESUME_REASON_LABEL[thread.resumeReason] ?? thread.resumeReason} ·{' '}
        {formatStaleness(thread.staleMinutes)}
      </span>
      {thread.driftStatus === 'DRIFTING' && (
        <div>
          <DriftWarning driftStatus={thread.driftStatus} driftScore={thread.driftScore} />
        </div>
      )}
      <div>Next action: {thread.nextAction ?? '— not set —'}</div>
    </li>
  );
}

function Section({ title, threads }: { title: string; threads: DashboardThread[] }) {
  return (
    <section style={{ marginBottom: '30px' }}>
      <h2>
        {title} ({threads.length})
      </h2>
      {threads.length === 0 ? (
        <p>None</p>
      ) : (
        <ul>
          {threads.map((thread) => (
            <ThreadRow key={thread.threadId} thread={thread} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Today() {
  const resource = useAsyncResource<TodayDashboardResponse>(() =>
    threadKeeperClient.getTodayDashboard(),
  );
  const dashboard = resource.data;

  if (resource.loading) return <div>Loading today&apos;s dashboard...</div>;
  if (!dashboard) {
    return (
      <div style={{ padding: '20px' }}>
        <Link href="/">← Back</Link>
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

  // The server ranks by priority, drift, and staleness -- the first entry is the
  // one thread to resume if you only have time for one.
  const continueNow = dashboard.recommendedOrder[0] ?? null;

  return (
    <div style={{ padding: '20px' }}>
      <Link href="/">← Back</Link>
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
              Why: {RESUME_REASON_LABEL[continueNow.resumeReason] ?? continueNow.resumeReason} ·{' '}
              {formatStaleness(continueNow.staleMinutes)}
            </p>
            <p>Next action: {continueNow.nextAction ?? '— not set —'}</p>
          </div>
        )}
      </section>

      <Section title="Active" threads={dashboard.activeThreads} />
      <Section title="Stale" threads={dashboard.staleThreads} />
      <Section title="Blocked" threads={dashboard.blockedThreads} />
      <Section title="Completed Today" threads={dashboard.completedToday} />
    </div>
  );
}
