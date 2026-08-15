import { threadKeeperClient } from '@/api/client';
import { DashboardThread, TodayDashboardResponse } from '@/types/dashboard';
import DashboardThreadList from '@/components/DashboardThreadList';
import NavBar from '@/components/NavBar';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { formatTimestamp } from '@/lib/format';

/**
 * recommendedOrder is a list of thread ids; the full objects only live in activeThreads.
 * Ids without a matching active thread are dropped rather than rendered as blanks.
 */
function resolveRecommended(dashboard: TodayDashboardResponse): DashboardThread[] {
  const byId = new Map(dashboard.activeThreads.map((thread) => [thread.threadId, thread]));
  return dashboard.recommendedOrder
    .map((threadId) => byId.get(threadId))
    .filter((thread): thread is DashboardThread => thread !== undefined);
}

export default function Today() {
  const {
    data: dashboard,
    error,
    loading,
    failures,
    retrying,
    reload,
  } = useAsyncResource(() => threadKeeperClient.getTodayDashboard());

  return (
    <div style={{ padding: '20px' }}>
      <NavBar current="/today" />
      <h1>Today</h1>

      {error && (
        <LoadError error={error} failures={failures} retrying={retrying} onRetry={reload} />
      )}
      {loading && <p>Loading...</p>}

      {dashboard && (
        <>
          <section style={{ marginBottom: '20px' }}>
            <h2>Continue Now</h2>
            <p style={{ color: '#666', fontSize: '13px' }}>
              우선순위, 방향 이탈, 멈춘 시간을 합산한 순서입니다.
            </p>
            <DashboardThreadList
              threads={resolveRecommended(dashboard)}
              emptyMessage="이어갈 활성 스레드가 없습니다."
            />
          </section>

          <section style={{ marginBottom: '20px' }}>
            <h2>Drift Warning ({dashboard.staleThreads.length})</h2>
            <DashboardThreadList
              threads={dashboard.staleThreads}
              emptyMessage="오래 멈춘 스레드가 없습니다."
            />
          </section>

          <section style={{ marginBottom: '20px' }}>
            <h2>Needs Handoff ({dashboard.blockedThreads.length})</h2>
            <p style={{ color: '#666', fontSize: '13px' }}>막혔거나 인계가 필요한 스레드입니다.</p>
            <DashboardThreadList
              threads={dashboard.blockedThreads}
              emptyMessage="막힌 스레드가 없습니다."
            />
          </section>

          <section style={{ marginBottom: '20px' }}>
            <h2>Completed Today ({dashboard.completedToday.length})</h2>
            {dashboard.completedToday.length === 0 ? (
              <p style={{ color: '#888' }}>오늘 완료한 스레드가 없습니다.</p>
            ) : (
              <ul>
                {dashboard.completedToday.map((thread) => (
                  <li key={thread.threadId}>
                    <strong>{thread.title}</strong>
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                      완료 {formatTimestamp(thread.completedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Active Threads ({dashboard.activeThreads.length})</h2>
            <DashboardThreadList
              threads={dashboard.activeThreads}
              emptyMessage="활성 스레드가 없습니다."
              showNextAction={false}
            />
          </section>
        </>
      )}
    </div>
  );
}
