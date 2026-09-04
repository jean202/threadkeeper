import Link from 'next/link';
import { DashboardThread } from '@/types/dashboard';
import DriftWarning from '@/components/DriftWarning';
import { formatStaleness } from '@/lib/format';

/** Why a thread surfaced, in words rather than the enum name. */
const RESUME_REASON_LABEL: Record<DashboardThread['resumeReason'], string> = {
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
  DRIFTING: 'Drifting from original intent',
  STALE: 'Untouched for a while',
  MISSING_NEXT_ACTION: 'No next action recorded',
  HIGH_PRIORITY: 'High priority',
  READY: 'Ready to continue',
};

/** The same wording wherever a resume reason is shown, list or not. */
export function resumeReasonLabel(reason: DashboardThread['resumeReason']): string {
  return RESUME_REASON_LABEL[reason] ?? reason;
}

export function ThreadRow({ thread, rank }: { thread: DashboardThread; rank?: number }) {
  return (
    <li style={{ marginBottom: '12px' }}>
      {rank !== undefined && <strong>{rank}. </strong>}
      <Link href={`/threads/${thread.threadId}`}>
        <strong>{thread.title}</strong>
      </Link>{' '}
      <span>
        [{thread.priority}] {resumeReasonLabel(thread.resumeReason)} ·{' '}
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

/**
 * A titled bucket of dashboard threads. `ranked` numbers the rows, for the
 * places where the order is the point rather than incidental.
 */
export default function DashboardThreadList({
  title,
  threads,
  ranked = false,
  emptyText = 'None',
}: {
  title: string;
  threads: DashboardThread[];
  ranked?: boolean;
  emptyText?: string;
}) {
  return (
    <section style={{ marginBottom: '30px' }}>
      <h2>
        {title} ({threads.length})
      </h2>
      {threads.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul>
          {threads.map((thread, index) => (
            <ThreadRow
              key={thread.threadId}
              thread={thread}
              rank={ranked ? index + 1 : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
