import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return { ...actual, threadKeeperClient: { getTodayDashboard: vi.fn() } };
});

import Today from '@/pages/today';
import { threadKeeperClient } from '@/api/client';
import { todayDashboard } from '@/test/fixtures';

const client = threadKeeperClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

function refused() {
  return Object.assign(new Error('Network Error'), { isAxiosError: true, response: undefined });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

async function settle() {
  await act(async () => {});
}

describe('cold boot recovery', () => {
  it('fills itself in once the API finishes booting, with no manual reload', async () => {
    vi.useFakeTimers();
    // The API is still starting: the first two loads are refused outright.
    client.getTodayDashboard
      .mockRejectedValueOnce(refused())
      .mockRejectedValueOnce(refused())
      .mockResolvedValue(todayDashboard);

    render(<Today />);

    await settle();
    // The page says it is still trying rather than dead-ending on an error.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not reach the API');
    expect(alert).toHaveTextContent('may still be booting');
    expect(alert).toHaveTextContent('Retrying in 1s (1 failed)');

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole('alert')).toHaveTextContent('Retrying in 2s (2 failed)');

    await act(() => vi.advanceTimersByTimeAsync(2000));

    // Recovered on its own: the dashboard is there and the error is gone.
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Continue Now' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(client.getTodayDashboard).toHaveBeenCalledTimes(3);
  });

  it('offers a manual retry that does not wait out the backoff', async () => {
    client.getTodayDashboard.mockRejectedValueOnce(refused()).mockResolvedValue(todayDashboard);

    render(<Today />);
    await settle();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry now' }));

    expect(await screen.findByRole('heading', { name: 'Continue Now' })).toBeInTheDocument();
  });

  it('does not retry when the API answered with a 4xx', async () => {
    vi.useFakeTimers();
    client.getTodayDashboard.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 404'), {
        isAxiosError: true,
        response: { status: 404, data: {} },
      }),
    );

    render(<Today />);
    await settle();

    // No "Retrying in Ns" notice: waiting would not help.
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this page');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Retrying in');

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(client.getTodayDashboard).toHaveBeenCalledTimes(1);
  });
});
