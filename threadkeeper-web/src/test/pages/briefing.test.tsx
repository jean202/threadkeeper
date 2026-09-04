import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return {
    ...actual,
    threadKeeperClient: { getBriefing: vi.fn(), getTodayDashboard: vi.fn() },
  };
});

import Briefing from '@/pages/briefing';
import { threadKeeperClient } from '@/api/client';
import { briefing, dashboardThread, driftingThread, todayDashboard } from '@/test/fixtures';

const client = threadKeeperClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  client.getBriefing.mockResolvedValue(briefing);
  client.getTodayDashboard.mockResolvedValue(todayDashboard);
});

function section(name: string) {
  return screen.getByRole('heading', { name }).closest('section')!;
}

describe('morning briefing', () => {
  it('leads with the server headline rather than one of its own', async () => {
    render(<Briefing />);

    expect(await screen.findByText(briefing.headline)).toBeInTheDocument();
  });

  // PRD 7.6: open sessions, suggested order, blocked items, stale sessions.
  it('covers the sections the briefing is specified to carry', async () => {
    render(<Briefing />);

    await screen.findByRole('heading', { name: 'Start here' });
    expect(screen.getByRole('heading', { name: /^Suggested order/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Blocked/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Stale/ })).toBeInTheDocument();
  });

  it('takes blocked and stale from the dashboard, not from the briefing list', async () => {
    client.getTodayDashboard.mockResolvedValue({
      ...todayDashboard,
      blockedThreads: [{ ...dashboardThread, threadId: 42, title: 'Blocked one' }],
      staleThreads: [],
    });
    render(<Briefing />);

    await screen.findByRole('heading', { name: 'Start here' });
    expect(section('Blocked (1)')).toHaveTextContent('Blocked one');
    expect(section('Stale (0)')).toHaveTextContent('Nothing has gone stale.');
  });

  it('puts the top-ranked thread first and links to it', async () => {
    render(<Briefing />);
    await screen.findByRole('heading', { name: 'Start here' });

    const start = section('Start here');
    expect(start).toHaveTextContent(driftingThread.title);
    expect(start.querySelector('a')).toHaveAttribute('href', `/threads/${driftingThread.threadId}`);
  });

  // The order is the point of this list, so it has to be visible as an order.
  it('numbers the suggested order in the ranking the server sent', async () => {
    render(<Briefing />);
    await screen.findByRole('heading', { name: 'Start here' });

    const ordered = section('Suggested order (2)');
    const rows = ordered.querySelectorAll('li');
    expect(rows[0]).toHaveTextContent('1.');
    expect(rows[0]).toHaveTextContent(driftingThread.title);
    expect(rows[1]).toHaveTextContent('2.');
    expect(rows[1]).toHaveTextContent(dashboardThread.title);
  });

  it('says there is nothing to pick up rather than showing an empty card', async () => {
    client.getBriefing.mockResolvedValue({ headline: 'No active threads to resume', threads: [] });
    render(<Briefing />);

    expect(await screen.findByText(/Nothing to pick up/)).toBeInTheDocument();
  });

  it('surfaces a load failure instead of rendering a blank briefing', async () => {
    client.getBriefing.mockRejectedValue(new Error('Network Error'));
    render(<Briefing />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network Error');
  });
});
