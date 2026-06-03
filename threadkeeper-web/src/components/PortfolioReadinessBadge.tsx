import { PortfolioReadiness } from '@/types/portfolio';

interface Props {
  readiness?: PortfolioReadiness;
}

function formatAge(ageDays: number): string {
  if (ageDays < 0) return '';
  if (ageDays === 0) return '오늘';
  return `${ageDays}일 전`;
}

export default function PortfolioReadinessBadge({ readiness }: Props) {
  if (!readiness) return null;

  const age = formatAge(readiness.ageDays);
  const label = age ? `${readiness.readiness}% · ${age}` : `${readiness.readiness}%`;

  return (
    <span
      title="portfolio-tracker"
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
      {readiness.stale ? ' (stale)' : ''}
    </span>
  );
}
