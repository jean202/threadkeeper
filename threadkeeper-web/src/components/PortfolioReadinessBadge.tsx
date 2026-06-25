import { PortfolioReadiness } from '@/types/portfolio';

function formatAge(ageDays: number): string {
  if (ageDays < 0) return '';
  if (ageDays === 0) return '오늘';
  return `${ageDays}일 전`;
}

// Days since last git commit. Labelled "커밋" to avoid confusion with scan age above.
export function formatCommitAge(days: number | null): string {
  if (days === null || days < 0) return '';
  if (days === 0) return '커밋 오늘';
  return `커밋 ${days}일 전`;
}

// 🟢 active (commits in last 7 days), ⚪ inactive, '' when unknown.
export function activityDot(active: boolean | null): string {
  if (active === null) return '';
  return active ? '🟢' : '⚪';
}

export default function PortfolioReadinessBadge({ readiness }: { readiness?: PortfolioReadiness }) {
  if (!readiness) return null;

  const age = formatAge(readiness.ageDays);
  const label = age ? `${readiness.readiness}% · ${age}` : `${readiness.readiness}%`;

  const commitAge = formatCommitAge(readiness.daysSinceLastCommit);
  const dot = activityDot(readiness.active);
  const gitPart = [commitAge, dot].filter(Boolean).join(' ');

  const title = readiness.lastCommitDate
    ? `portfolio-tracker · 마지막 커밋 ${readiness.lastCommitDate}`
    : 'portfolio-tracker';

  return (
    <span
      title={title}
      style={{
        marginLeft: '8px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '12px',
        border: '1px solid #ccc',
        opacity: readiness.stale ? 0.5 : 1,
      }}
    >
      포트폴리오 {label}
      {gitPart ? ` · ${gitPart}` : ''}
      {readiness.stale ? ' (stale)' : ''}
    </span>
  );
}
