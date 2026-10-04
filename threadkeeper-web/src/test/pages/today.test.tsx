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

    expect(await screen.findByRole('heading', { name: '오늘' })).toBeInTheDocument();
    expect(client.getTodayDashboard).toHaveBeenCalled();
  });

  it('shows every section the MVP screen calls for', async () => {
    render(<Today />);

    await screen.findByRole('heading', { name: '지금 이어서 할 일' });
    for (const section of ['진행 중 (2)', '오래 멈춤 (1)', '막힘 (0)', '오늘 완료 (0)']) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument();
    }
  });

  it('puts the top-ranked thread in Continue Now and links to it', async () => {
    render(<Today />);

    const continueNow = (await screen.findByRole('heading', { name: '지금 이어서 할 일' })).closest(
      'section',
    )!;
    const link = continueNow.querySelector('a')!;
    expect(link).toHaveAttribute('href', '/threads/1');
    expect(continueNow).toHaveTextContent('Fix web API contract');
    expect(continueNow).toHaveTextContent('한동안 손대지 않음');
  });

  // recommendedOrder carries ids now, so Continue Now is a lookup rather than a
  // read. Ranking second must actually change which thread it shows.
  it('follows the ranking rather than the list order', async () => {
    client.getTodayDashboard.mockResolvedValue({
      ...todayDashboard,
      recommendedOrder: [todayDashboard.activeThreads[1].threadId],
    });
    render(<Today />);

    const continueNow = (await screen.findByRole('heading', { name: '지금 이어서 할 일' })).closest(
      'section',
    )!;
    expect(continueNow).toHaveTextContent(todayDashboard.activeThreads[1].title);
    expect(continueNow).not.toHaveTextContent(todayDashboard.activeThreads[0].title);
  });

  it('shows nothing to resume rather than a blank card if a ranked id is missing', async () => {
    client.getTodayDashboard.mockResolvedValue({ ...todayDashboard, recommendedOrder: [9999] });
    render(<Today />);

    expect(await screen.findByText('이어서 할 진행 중인 스레드가 없어요.')).toBeInTheDocument();
  });

  it('warns about a drifting thread', async () => {
    render(<Today />);

    expect(await screen.findByText(/방향 이탈 \(처음 의도와 100% 다름\)/)).toBeInTheDocument();
  });

  it('renders staleness in human units', async () => {
    render(<Today />);

    // 480 minutes should read as hours, not "480m".
    expect(await screen.findAllByText(/8시간째 멈춤/)).not.toHaveLength(0);
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

    expect(await screen.findByText('이어서 할 진행 중인 스레드가 없어요.')).toBeInTheDocument();
  });
});
