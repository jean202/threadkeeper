import { DriftStatus } from '@/types/thread';

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

  if (driftStatus === 'DRIFTING') {
    return (
      <strong title="Recent activity has little in common with the original intent">
        ⚠ Drifting{score ? ` (${score} off intent)` : ''}
      </strong>
    );
  }

  if (driftStatus === 'ON_TRACK' && score === null) {
    return <span title="No recorded activity to compare yet">On track (not yet measured)</span>;
  }

  return (
    <span>
      {driftStatus === 'ON_TRACK' ? 'On track' : driftStatus}
      {score ? ` (${score} off intent)` : ''}
    </span>
  );
}
