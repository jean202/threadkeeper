import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/router', () => ({ useRouter: () => ({ query: { threadId: '1' } }) }));

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return {
    ...actual,
    threadKeeperClient: {
      getThread: vi.fn(),
      updateHandoff: vi.fn(),
      generateHandoffDraft: vi.fn(),
    },
  };
});

import HandoffComposer from '@/pages/threads/[threadId]/handoff';
import { threadKeeperClient } from '@/api/client';
import { handoff, threadDetail } from '@/test/fixtures';

const client = threadKeeperClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  client.getThread.mockResolvedValue(threadDetail);
  client.updateHandoff.mockResolvedValue(handoff);
});

describe('handoff composer', () => {
  it('saves the draft without changing its status', async () => {
    render(<HandoffComposer />);
    await screen.findByLabelText('Next action');

    await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(client.updateHandoff).toHaveBeenCalled());
    const [id, payload] = client.updateHandoff.mock.calls[0];
    expect(id).toBe(1);
    expect(payload).not.toHaveProperty('status');
    expect(payload.nextAction).toBe('Ship type fix');
  });

  it('finalizing sends the edits and READY together, so it cannot half-apply', async () => {
    render(<HandoffComposer />);
    await screen.findByLabelText('Next action');

    await userEvent.clear(screen.getByLabelText('Next action'));
    await userEvent.type(screen.getByLabelText('Next action'), 'Run the migration');
    await userEvent.click(screen.getByRole('button', { name: 'Finalize Handoff' }));

    await waitFor(() => expect(client.updateHandoff).toHaveBeenCalled());
    const [, payload] = client.updateHandoff.mock.calls[0];
    expect(payload.status).toBe('READY');
    expect(payload.nextAction).toBe('Run the migration');
  });

  it('sends a cleared field as null rather than an empty string', async () => {
    render(<HandoffComposer />);
    await screen.findByLabelText('What is blocked');

    await userEvent.clear(screen.getByLabelText('What is blocked'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(client.updateHandoff).toHaveBeenCalled());
    expect(client.updateHandoff.mock.calls[0][1].blockers).toBeNull();
  });

  it('offers to generate a draft when the thread has none', async () => {
    client.getThread.mockResolvedValue({ ...threadDetail, handoffs: [] });
    client.generateHandoffDraft.mockResolvedValue(handoff);
    render(<HandoffComposer />);

    await screen.findByRole('heading', { name: 'No handoff yet' });
    await userEvent.selectOptions(screen.getByLabelText('Target provider'), 'GEMINI');
    await userEvent.click(screen.getByRole('button', { name: 'Generate Draft' }));

    await waitFor(() =>
      expect(client.generateHandoffDraft).toHaveBeenCalledWith(1, { targetProvider: 'GEMINI' }),
    );
  });

  it('cannot finalize a handoff that is already ready', async () => {
    client.getThread.mockResolvedValue({
      ...threadDetail,
      handoffs: [{ ...handoff, status: 'READY' as const }],
    });
    render(<HandoffComposer />);
    await screen.findByLabelText('Next action');

    expect(screen.getByRole('button', { name: 'Finalize Handoff' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
  });
});
