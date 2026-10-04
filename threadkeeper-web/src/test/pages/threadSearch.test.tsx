import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return {
    ...actual,
    threadKeeperClient: { listThreads: vi.fn(), getPortfolioReadiness: vi.fn() },
  };
});

import Home from '@/pages/index';
import { threadKeeperClient } from '@/api/client';
import { threadListItem } from '@/test/fixtures';

const client = threadKeeperClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  client.listThreads.mockResolvedValue([threadListItem]);
  client.getPortfolioReadiness.mockResolvedValue(new Map());
});

/** The params of the most recent listThreads call. */
function lastQuery() {
  const calls = client.listThreads.mock.calls;
  return calls[calls.length - 1]?.[0];
}

describe('thread search', () => {
  it('lists everything unfiltered on first load', async () => {
    render(<Home />);

    expect(await screen.findByText(threadListItem.title)).toBeInTheDocument();
    expect(lastQuery()).toEqual({});
  });

  it('sends only the fields that were filled in', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    await user.type(screen.getByLabelText('키워드'), 'drift');
    await user.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => expect(client.listThreads).toHaveBeenCalledTimes(2));
    expect(lastQuery()).toEqual({
      q: 'drift',
      projectKey: undefined,
      provider: undefined,
      status: undefined,
      priority: undefined,
      activeWithinDays: undefined,
    });
  });

  it('passes every filter through with the names the API expects', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    await user.type(screen.getByLabelText('키워드'), 'handoff');
    await user.type(screen.getByLabelText('프로젝트'), 'threadkeeper');
    await user.selectOptions(screen.getByLabelText('AI 도구'), 'CODEX');
    await user.selectOptions(screen.getByLabelText('상태'), 'BLOCKED');
    await user.selectOptions(screen.getByLabelText('우선순위'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('최근 활동'), '7');
    await user.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => expect(lastQuery()).toEqual({
      q: 'handoff',
      projectKey: 'threadkeeper',
      provider: 'CODEX',
      status: 'BLOCKED',
      priority: 'HIGH',
      activeWithinDays: 7,
    }));
  });

  it('treats whitespace as an empty field rather than a filter', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    await user.type(screen.getByLabelText('키워드'), '   ');
    await user.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => expect(client.listThreads).toHaveBeenCalledTimes(2));
    expect(lastQuery()?.q).toBeUndefined();
  });

  it('says no match rather than no threads once filters are applied', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    client.listThreads.mockResolvedValue([]);
    await user.type(screen.getByLabelText('키워드'), 'nothing matches this');
    await user.click(screen.getByRole('button', { name: '검색' }));

    expect(await screen.findByText('조건에 맞는 스레드가 없어요.')).toBeInTheDocument();
  });

  it('reports an empty database without blaming the filters', async () => {
    client.listThreads.mockResolvedValue([]);
    render(<Home />);

    expect(await screen.findByText('아직 스레드가 없어요.')).toBeInTheDocument();
  });

  it('clears back to the unfiltered list', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    const keyword = screen.getByLabelText('키워드');
    await user.type(keyword, 'drift');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(client.listThreads).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole('button', { name: '초기화' }));

    await waitFor(() => expect(client.listThreads).toHaveBeenCalledTimes(3));
    expect(lastQuery()).toEqual({});
    expect(keyword).toHaveValue('');
  });

  it('keeps the previous results on screen while a search is in flight', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    let release: (value: unknown) => void = () => {};
    client.listThreads.mockReturnValue(new Promise((resolve) => { release = resolve; }));

    await user.type(screen.getByLabelText('키워드'), 'drift');
    await user.click(screen.getByRole('button', { name: '검색' }));

    // Still the old list, and the button says so.
    expect(screen.getByText(threadListItem.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검색 중...' })).toBeInTheDocument();

    release([]);
    expect(await screen.findByText('조건에 맞는 스레드가 없어요.')).toBeInTheDocument();
  });

  it('reports a failed search instead of staying on Searching...', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    // A 4xx is final, so no retry is scheduled and nothing would ever settle.
    client.listThreads.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 400'), {
        isAxiosError: true,
        response: { status: 400 },
      }),
    );
    await user.selectOptions(screen.getByLabelText('AI 도구'), 'CODEX');

    expect(await screen.findByRole('alert')).toHaveTextContent('status code 400');
    expect(screen.getByRole('button', { name: '검색' })).toBeEnabled();
  });

  it('lets Clear abandon a search that is still in flight', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    client.listThreads.mockReturnValueOnce(new Promise(() => {}));
    await user.type(screen.getByLabelText('키워드'), 'drift');
    await user.click(screen.getByRole('button', { name: '검색' }));
    expect(screen.getByRole('button', { name: '검색 중...' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '초기화' }));

    await waitFor(() => expect(lastQuery()).toEqual({}));
    expect(await screen.findByRole('button', { name: '검색' })).toBeEnabled();
  });

  it('applies a dropdown as soon as it changes, without pressing Search', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    await user.selectOptions(screen.getByLabelText('AI 도구'), 'CODEX');

    await waitFor(() => expect(client.listThreads).toHaveBeenCalledTimes(2));
    expect(lastQuery()).toMatchObject({ provider: 'CODEX', q: undefined });

    // Back to Any drops the filter again.
    await user.selectOptions(screen.getByLabelText('AI 도구'), '');
    await waitFor(() => expect(client.listThreads).toHaveBeenCalledTimes(3));
    expect(lastQuery()?.provider).toBeUndefined();
  });

  it('does not search on every keystroke in the text fields', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    await user.type(screen.getByLabelText('키워드'), 'drift');
    await user.type(screen.getByLabelText('프로젝트'), 'billing');

    expect(client.listThreads).toHaveBeenCalledTimes(1);
  });
});
