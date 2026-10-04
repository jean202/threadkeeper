import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DriftWarning from '@/components/DriftWarning';

describe('DriftWarning', () => {
  it('warns only when the thread is actually drifting', () => {
    const { unmount } = render(<DriftWarning driftStatus="DRIFTING" driftScore={100} />);
    expect(screen.getByText(/⚠ 방향 이탈 \(처음 의도와 100% 다름\)/)).toBeInTheDocument();
    unmount();

    render(<DriftWarning driftStatus="ON_TRACK" driftScore={40} />);
    expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
    expect(screen.getByText(/정상 진행 \(처음 의도와 40% 다름\)/)).toBeInTheDocument();
  });

  it('distinguishes "not yet measured" from "on track at 0"', () => {
    // A thread with no activity has a null score, and saying "on track" flatly
    // would overstate what the evaluator actually knows.
    const { unmount } = render(<DriftWarning driftStatus="ON_TRACK" driftScore={null} />);
    expect(screen.getByText('정상 진행 (아직 측정 전)')).toBeInTheDocument();
    unmount();

    render(<DriftWarning driftStatus="ON_TRACK" driftScore={0} />);
    expect(screen.getByText('정상 진행 (처음 의도와 0% 다름)')).toBeInTheDocument();
  });

  it('reports blocked and completed as themselves', () => {
    const { unmount } = render(<DriftWarning driftStatus="BLOCKED" driftScore={null} />);
    expect(screen.getByText('막힘')).toBeInTheDocument();
    unmount();

    render(<DriftWarning driftStatus="COMPLETED" driftScore={12.5} />);
    expect(screen.getByText(/완료/)).toBeInTheDocument();
  });

  it('rounds the score for display', () => {
    render(<DriftWarning driftStatus="DRIFTING" driftScore={66.67} />);
    expect(screen.getByText(/처음 의도와 67% 다름/)).toBeInTheDocument();
  });
});
