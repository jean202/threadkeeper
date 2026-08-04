import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/router', () => ({
  useRouter: () => ({ query: { threadId: '1' }, push }),
}));

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return {
    ...actual,
    threadKeeperClient: {
      getThread: vi.fn(),
      getPortfolioReadiness: vi.fn(),
      updateNextAction: vi.fn(),
      updateThreadStatus: vi.fn(),
      createSnapshot: vi.fn(),
      generateHandoffDraft: vi.fn(),
      evaluateDrift: vi.fn(),
    },
  };
});

import ThreadDetail from '@/pages/threads/[threadId]';
import { threadKeeperClient } from '@/api/client';
import { threadDetail } from '@/test/fixtures';

const client = threadKeeperClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  client.getThread.mockResolvedValue(threadDetail);
  client.getPortfolioReadiness.mockResolvedValue(new Map());
});

describe('thread detail', () => {
  it('renders a thread that has a handoff', async () => {
    // Regression: the page used to read handoff.draftContent, a field the API
    // never sends, and threw "Cannot read properties of undefined".
    render(<ThreadDetail />);

    expect(await screen.findByRole('heading', { name: threadDetail.title })).toBeInTheDocument();
    // Scope to the Handoff section: the provider names also appear in the
    // create-handoff dropdown.
    const handoffSection = screen.getByRole('heading', { name: /^Handoff$/ }).closest('section')!;
    expect(handoffSection).toHaveTextContent('CLAUDE');
    expect(handoffSection).toHaveTextContent('Continue in Claude');
    expect(handoffSection).toHaveTextContent('Ship type fix');
  });

  it('shows the notification event type, not a blank line', async () => {
    // Regression: the page read event.ruleType; the API sends eventType.
    render(<ThreadDetail />);

    expect(await screen.findByText(/INACTIVITY/)).toBeInTheDocument();
    expect(screen.getByText(/QUEUED/)).toBeInTheDocument();
  });

  it('shows the drift score alongside the status', async () => {
    render(<ThreadDetail />);

    expect(await screen.findByText(/On track/)).toBeInTheDocument();
    expect(screen.getByText(/40% off intent/)).toBeInTheDocument();
  });

  it('pins the next action and refetches so the page shows server state', async () => {
    client.updateNextAction.mockResolvedValue({});
    render(<ThreadDetail />);
    await screen.findByRole('heading', { name: threadDetail.title });

    await userEvent.click(screen.getByRole('button', { name: 'Pin Next Action' }));

    await waitFor(() => expect(client.updateNextAction).toHaveBeenCalledWith(1, 'verify'));
    // Once on mount, once after the write.
    expect(client.getThread).toHaveBeenCalledTimes(2);
  });

  it('marks the thread completed', async () => {
    client.updateThreadStatus.mockResolvedValue({});
    render(<ThreadDetail />);
    await screen.findByRole('heading', { name: threadDetail.title });

    await userEvent.click(screen.getByRole('button', { name: 'Mark Completed' }));

    await waitFor(() => expect(client.updateThreadStatus).toHaveBeenCalledWith(1, 'COMPLETED'));
  });

  it('generates a handoff draft for the chosen provider', async () => {
    client.generateHandoffDraft.mockResolvedValue(threadDetail.handoffs[0]);
    render(<ThreadDetail />);
    await screen.findByRole('heading', { name: threadDetail.title });

    await userEvent.selectOptions(screen.getByLabelText('Create handoff draft'), 'CODEX');
    await userEvent.click(screen.getByRole('button', { name: 'Create Handoff' }));

    await waitFor(() =>
      expect(client.generateHandoffDraft).toHaveBeenCalledWith(1, { targetProvider: 'CODEX' }),
    );
  });

  it('surfaces the API message when an action is rejected', async () => {
    const axiosError = Object.assign(new Error('Request failed with status code 400'), {
      isAxiosError: true,
      response: { data: { code: 'BAD', message: 'Next action is too long', fieldErrors: null } },
    });
    client.updateNextAction.mockRejectedValue(axiosError);
    render(<ThreadDetail />);
    await screen.findByRole('heading', { name: threadDetail.title });

    await userEvent.click(screen.getByRole('button', { name: 'Pin Next Action' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Next action is too long');
  });

  it('does not offer Mark Completed for an already completed thread', async () => {
    client.getThread.mockResolvedValue({ ...threadDetail, status: 'COMPLETED' });
    render(<ThreadDetail />);
    await screen.findByRole('heading', { name: threadDetail.title });

    expect(screen.getByRole('button', { name: 'Mark Completed' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeEnabled();
  });
});
