import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DriftWarning from '@/components/DriftWarning';

describe('DriftWarning', () => {
  it('warns only when the thread is actually drifting', () => {
    const { unmount } = render(<DriftWarning driftStatus="DRIFTING" driftScore={100} />);
    expect(screen.getByText(/⚠ Drifting \(100% off intent\)/)).toBeInTheDocument();
    unmount();

    render(<DriftWarning driftStatus="ON_TRACK" driftScore={40} />);
    expect(screen.queryByText(/⚠/)).not.toBeInTheDocument();
    expect(screen.getByText(/On track \(40% off intent\)/)).toBeInTheDocument();
  });

  it('distinguishes "not yet measured" from "on track at 0"', () => {
    // A thread with no activity has a null score, and saying "on track" flatly
    // would overstate what the evaluator actually knows.
    const { unmount } = render(<DriftWarning driftStatus="ON_TRACK" driftScore={null} />);
    expect(screen.getByText('On track (not yet measured)')).toBeInTheDocument();
    unmount();

    render(<DriftWarning driftStatus="ON_TRACK" driftScore={0} />);
    expect(screen.getByText('On track (0% off intent)')).toBeInTheDocument();
  });

  it('reports blocked and completed as themselves', () => {
    const { unmount } = render(<DriftWarning driftStatus="BLOCKED" driftScore={null} />);
    expect(screen.getByText('BLOCKED')).toBeInTheDocument();
    unmount();

    render(<DriftWarning driftStatus="COMPLETED" driftScore={12.5} />);
    expect(screen.getByText(/COMPLETED/)).toBeInTheDocument();
  });

  it('rounds the score for display', () => {
    render(<DriftWarning driftStatus="DRIFTING" driftScore={66.67} />);
    expect(screen.getByText(/67% off intent/)).toBeInTheDocument();
  });
});
