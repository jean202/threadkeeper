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

    await user.type(screen.getByLabelText('Keyword'), 'drift');
    await user.click(screen.getByRole('button', { name: 'Search' }));

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

    await user.type(screen.getByLabelText('Keyword'), 'handoff');
    await user.type(screen.getByLabelText('Project'), 'threadkeeper');
    await user.selectOptions(screen.getByLabelText('Provider'), 'CODEX');
    await user.selectOptions(screen.getByLabelText('Status'), 'BLOCKED');
    await user.selectOptions(screen.getByLabelText('Priority'), 'HIGH');
    await user.selectOptions(screen.getByLabelText('Active within'), '7');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(client.listThreads).toHaveBeenCalledTimes(2));
    expect(lastQuery()).toEqual({
      q: 'handoff',
      projectKey: 'threadkeeper',
      provider: 'CODEX',
      status: 'BLOCKED',
      priority: 'HIGH',
      activeWithinDays: 7,
    });
  });

  it('treats whitespace as an empty field rather than a filter', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    await user.type(screen.getByLabelText('Keyword'), '   ');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(client.listThreads).toHaveBeenCalledTimes(2));
    expect(lastQuery()?.q).toBeUndefined();
  });

  it('says no match rather than no threads once filters are applied', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    client.listThreads.mockResolvedValue([]);
    await user.type(screen.getByLabelText('Keyword'), 'nothing matches this');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('No threads match these filters.')).toBeInTheDocument();
  });

  it('reports an empty database without blaming the filters', async () => {
    client.listThreads.mockResolvedValue([]);
    render(<Home />);

    expect(await screen.findByText('No threads found')).toBeInTheDocument();
  });

  it('clears back to the unfiltered list', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText(threadListItem.title);

    const keyword = screen.getByLabelText('Keyword');
    await user.type(keyword, 'drift');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(client.listThreads).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole('button', { name: 'Clear' }));

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

    await user.type(screen.getByLabelText('Keyword'), 'drift');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    // Still the old list, and the button says so.
    expect(screen.getByText(threadListItem.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Searching...' })).toBeInTheDocument();

    release([]);
    expect(await screen.findByText('No threads match these filters.')).toBeInTheDocument();
  });
});
