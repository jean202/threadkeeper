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
    expect(alert).toHaveTextContent('API 서버에 연결할 수 없어요');
    expect(alert).toHaveTextContent('아직 시작 중일 수 있어요');
    expect(alert).toHaveTextContent('1초 뒤 다시 시도 (1번 실패)');

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole('alert')).toHaveTextContent('2초 뒤 다시 시도 (2번 실패)');

    await act(() => vi.advanceTimersByTimeAsync(2000));

    // Recovered on its own: the dashboard is there and the error is gone.
    expect(screen.getByRole('heading', { name: '오늘' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '지금 이어서 할 일' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(client.getTodayDashboard).toHaveBeenCalledTimes(3);
  });

  it('offers a manual retry that does not wait out the backoff', async () => {
    client.getTodayDashboard.mockRejectedValueOnce(refused()).mockResolvedValue(todayDashboard);

    render(<Today />);
    await settle();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '지금 다시 시도' }));

    expect(await screen.findByRole('heading', { name: '지금 이어서 할 일' })).toBeInTheDocument();
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
    expect(screen.getByRole('alert')).toHaveTextContent('이 페이지를 불러오지 못했어요');
    expect(screen.getByRole('alert')).not.toHaveTextContent('다시 시도 (');

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(client.getTodayDashboard).toHaveBeenCalledTimes(1);
  });

  it('points at Docker when the api answers but the database is down', async () => {
    vi.useFakeTimers();
    const databaseDown = Object.assign(new Error('Request failed with status code 503'), {
      isAxiosError: true,
      response: {
        status: 503,
        data: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not reachable.', fieldErrors: [] },
      },
    });
    client.getTodayDashboard.mockRejectedValueOnce(databaseDown).mockResolvedValue(todayDashboard);

    render(<Today />);
    await settle();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('데이터베이스에 연결할 수 없어요.');
    expect(alert).toHaveTextContent('Docker Desktop');
    // A 503 is worth waiting out: once Docker is back the page heals itself.
    expect(alert).toHaveTextContent('1초 뒤 다시 시도 (1번 실패)');

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole('heading', { name: '오늘' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

