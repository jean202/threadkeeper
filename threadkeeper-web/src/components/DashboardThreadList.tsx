import Link from 'next/link';
import { DashboardThread } from '@/types/dashboard';
import { formatStaleMinutes, isWarningReason, resumeReasonLabel } from '@/lib/format';

function ReasonBadge({ thread }: { thread: DashboardThread }) {
  const warning = isWarningReason(thread.resumeReason);
  return (
    <span
      style={{
        marginLeft: '8px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '12px',
        border: `1px solid ${warning ? '#d97706' : '#ccc'}`,
        color: warning ? '#b45309' : '#666',
      }}
    >
      {resumeReasonLabel(thread.resumeReason)}
    </span>
  );
}

export default function DashboardThreadList({
  threads,
  emptyMessage,
  showNextAction = true,
}: {
  threads: DashboardThread[];
  emptyMessage: string;
  showNextAction?: boolean;
}) {
  if (threads.length === 0) {
    return <p style={{ color: '#888' }}>{emptyMessage}</p>;
  }

  return (
    <ul>
      {threads.map((thread) => (
        <li key={thread.threadId}>
          <div>
            <Link href={`/threads/${thread.threadId}`}>
              <strong>{thread.title}</strong>
            </Link>
            <ReasonBadge thread={thread} />
          </div>
          <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
            {thread.projectKey} · {thread.priority} · {thread.driftStatus} ·{' '}
            {formatStaleMinutes(thread.staleMinutes)}
          </div>
          {showNextAction && (
            <div style={{ marginTop: '4px' }}>
              다음 행동: {thread.nextAction || <em style={{ color: '#b45309' }}>지정되지 않음</em>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
