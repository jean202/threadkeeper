import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return { ...actual, threadKeeperClient: { getTodayDashboard: vi.fn() } };
});

import Today from '@/pages/today';
import { threadKeeperClient } from '@/api/client';
import { todayDashboard } from '@/test/fixtures';

const client = threadKeeperClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  client.getTodayDashboard.mockResolvedValue(todayDashboard);
});

describe('today dashboard', () => {
  it('reads the server ranking rather than filtering the thread list itself', async () => {
    render(<Today />);

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(client.getTodayDashboard).toHaveBeenCalled();
  });

  it('shows every section the MVP screen calls for', async () => {
    render(<Today />);

    await screen.findByRole('heading', { name: 'Continue Now' });
    for (const section of ['Active (2)', 'Stale (1)', 'Blocked (0)', 'Completed Today (0)']) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument();
    }
  });

  it('puts the top-ranked thread in Continue Now and links to it', async () => {
    render(<Today />);

    const continueNow = (await screen.findByRole('heading', { name: 'Continue Now' })).closest(
      'section',
    )!;
    const link = continueNow.querySelector('a')!;
    expect(link).toHaveAttribute('href', '/threads/1');
    expect(continueNow).toHaveTextContent('Fix web API contract');
    expect(continueNow).toHaveTextContent('Untouched for a while');
  });

  it('warns about a drifting thread', async () => {
    render(<Today />);

    expect(await screen.findByText(/Drifting \(100% off intent\)/)).toBeInTheDocument();
  });

  it('renders staleness in human units', async () => {
    render(<Today />);

    // 480 minutes should read as hours, not "480m".
    expect(await screen.findAllByText(/8h idle/)).not.toHaveLength(0);
  });

  it('says so plainly when there is nothing to resume', async () => {
    client.getTodayDashboard.mockResolvedValue({
      activeThreads: [],
      staleThreads: [],
      blockedThreads: [],
      completedToday: [],
      recommendedOrder: [],
    });
    render(<Today />);

    expect(await screen.findByText('Nothing active to resume.')).toBeInTheDocument();
  });
});
