import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { BriefingResponse, DashboardThread, TodayDashboardResponse } from '@/types/dashboard';
import DashboardThreadList from '@/components/DashboardThreadList';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';

interface BriefingData {
  briefing: BriefingResponse;
  today: TodayDashboardResponse;
}

/**
 * PRD 7.6 asks the morning briefing for open sessions, a suggested order,
 * blocked items and stale sessions. The briefing endpoint supplies the
 * headline and the order; the blocked and stale buckets already exist on the
 * today endpoint, so this composes the two rather than having the server
 * compute the same buckets twice.
 */
export default function Briefing() {
  const resource = useAsyncResource<BriefingData>(async () => {
    const [briefing, today] = await Promise.all([
      threadKeeperClient.getBriefing(),
      threadKeeperClient.getTodayDashboard(),
    ]);
    return { briefing, today };
  });

  if (resource.loading) return <div style={{ padding: '20px' }}>Loading the briefing...</div>;
  if (!resource.data) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Morning Briefing</h1>
        <LoadError
          error={resource.error ?? 'Failed to load the briefing'}
          failures={resource.failures}
          retrying={resource.retrying}
          onRetry={resource.reload}
        />
      </div>
    );
  }

  const { briefing, today } = resource.data;
  const first: DashboardThread | null = briefing.threads[0] ?? null;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Morning Briefing</h1>
      <p>{briefing.headline}</p>

      <section style={{ marginBottom: '30px' }}>
        <h2>Start here</h2>
        {!first ? (
          <p>Nothing to pick up. Every thread is either finished or parked.</p>
        ) : (
          <p>
            <Link href={`/threads/${first.threadId}`}>
              <strong>{first.title}</strong>
            </Link>
            <br />
            Next action: {first.nextAction ?? '— not set —'}
          </p>
        )}
      </section>

      {/* The server has already ranked these; the numbering is the suggested order. */}
      <DashboardThreadList
        title="Suggested order"
        threads={briefing.threads}
        ranked
        emptyText="No active threads to rank."
      />

      <DashboardThreadList
        title="Blocked"
        threads={today.blockedThreads}
        emptyText="Nothing blocked."
      />

      <DashboardThreadList
        title="Stale"
        threads={today.staleThreads}
        emptyText="Nothing has gone stale."
      />

      <p>
        <Link href="/today">See the full dashboard →</Link>
      </p>
    </div>
  );
}
