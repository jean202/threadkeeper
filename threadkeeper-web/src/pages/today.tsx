import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { DashboardThread, TodayDashboardResponse } from '@/types/dashboard';
import DriftWarning from '@/components/DriftWarning';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { formatStaleness } from '@/lib/format';
import { PRIORITY_LABEL, RESUME_REASON_LABEL, label } from '@/lib/labels';

function ThreadRow({ thread }: { thread: DashboardThread }) {
  return (
    <li style={{ marginBottom: '12px' }}>
      <Link href={`/threads/${thread.threadId}`}>
        <strong>{thread.title}</strong>
      </Link>{' '}
      <span>
        [{label(PRIORITY_LABEL, thread.priority)}] {label(RESUME_REASON_LABEL, thread.resumeReason)} ·{' '}
        {formatStaleness(thread.staleMinutes)}
      </span>
      {thread.driftStatus === 'DRIFTING' && (
        <div>
          <DriftWarning driftStatus={thread.driftStatus} driftScore={thread.driftScore} />
        </div>
      )}
      <div>다음 할 일: {thread.nextAction ?? '— 아직 없음 —'}</div>
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
        <p>없음</p>
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

  if (resource.loading) return <div>오늘의 대시보드를 불러오는 중...</div>;
  if (!dashboard) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>오늘</h1>
        <LoadError
          error={resource.error ?? '대시보드를 불러오지 못했어요'}
          code={resource.errorCode}
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
      <h1>오늘</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2>지금 이어서 할 일</h2>
        {!continueNow ? (
          <p>이어서 할 진행 중인 스레드가 없어요.</p>
        ) : (
          <div>
            <Link href={`/threads/${continueNow.threadId}`}>
              <strong>{continueNow.title}</strong>
            </Link>
            <p>
              이유: {label(RESUME_REASON_LABEL, continueNow.resumeReason)} ·{' '}
              {formatStaleness(continueNow.staleMinutes)}
            </p>
            <p>다음 할 일: {continueNow.nextAction ?? '— 아직 없음 —'}</p>
          </div>
        )}
      </section>

      <Section title="진행 중" threads={dashboard.activeThreads} />
      <Section title="오래 멈춤" threads={dashboard.staleThreads} />
      <Section title="막힘" threads={dashboard.blockedThreads} />
      <Section title="오늘 완료" threads={dashboard.completedToday} />
    </div>
  );
}
