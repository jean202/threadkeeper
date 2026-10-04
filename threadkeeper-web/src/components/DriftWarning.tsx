import { DriftStatus } from '@/types/thread';
import { DRIFT_LABEL, label } from '@/lib/labels';

interface Props {
  driftStatus: DriftStatus;
  driftScore: number | null;
}

/**
 * The MVP's `Drift Warning` widget. Only DRIFTING is a warning -- the other
 * statuses are reported plainly so the badge keeps its meaning.
 */
export default function DriftWarning({ driftStatus, driftScore }: Props) {
  const score = driftScore === null ? null : `${Math.round(driftScore)}%`;
  const offIntent = score ? ` (처음 의도와 ${score} 다름)` : '';

  if (driftStatus === 'DRIFTING') {
    return (
      <strong title="최근 활동이 처음 의도와 거의 겹치지 않아요">
        ⚠ 방향 이탈{offIntent}
      </strong>
    );
  }

  if (driftStatus === 'ON_TRACK' && score === null) {
    return <span title="아직 비교할 활동 기록이 없어요">정상 진행 (아직 측정 전)</span>;
  }

  return (
    <span>
      {label(DRIFT_LABEL, driftStatus)}
      {offIntent}
    </span>
  );
}
