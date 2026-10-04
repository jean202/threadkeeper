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
    await screen.findByLabelText('다음 할 일');

    await userEvent.click(screen.getByRole('button', { name: '초안 저장' }));

    await waitFor(() => expect(client.updateHandoff).toHaveBeenCalled());
    const [id, payload] = client.updateHandoff.mock.calls[0];
    expect(id).toBe(1);
    expect(payload).not.toHaveProperty('status');
    expect(payload.nextAction).toBe('Ship type fix');
  });

  it('finalizing sends the edits and READY together, so it cannot half-apply', async () => {
    render(<HandoffComposer />);
    await screen.findByLabelText('다음 할 일');

    await userEvent.clear(screen.getByLabelText('다음 할 일'));
    await userEvent.type(screen.getByLabelText('다음 할 일'), 'Run the migration');
    await userEvent.click(screen.getByRole('button', { name: '핸드오프 확정' }));

    await waitFor(() => expect(client.updateHandoff).toHaveBeenCalled());
    const [, payload] = client.updateHandoff.mock.calls[0];
    expect(payload.status).toBe('READY');
    expect(payload.nextAction).toBe('Run the migration');
  });

  it('sends a cleared field as null rather than an empty string', async () => {
    render(<HandoffComposer />);
    await screen.findByLabelText('막힌 점');

    await userEvent.clear(screen.getByLabelText('막힌 점'));
    await userEvent.click(screen.getByRole('button', { name: '초안 저장' }));

    await waitFor(() => expect(client.updateHandoff).toHaveBeenCalled());
    expect(client.updateHandoff.mock.calls[0][1].blockers).toBeNull();
  });

  it('offers to generate a draft when the thread has none', async () => {
    client.getThread.mockResolvedValue({ ...threadDetail, handoffs: [] });
    client.generateHandoffDraft.mockResolvedValue(handoff);
    render(<HandoffComposer />);

    await screen.findByRole('heading', { name: '아직 핸드오프가 없어요' });
    await userEvent.selectOptions(screen.getByLabelText('넘겨받을 AI 도구'), 'GEMINI');
    await userEvent.click(screen.getByRole('button', { name: '초안 만들기' }));

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
    await screen.findByLabelText('다음 할 일');

    expect(screen.getByRole('button', { name: '핸드오프 확정' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '초안 저장' })).toBeEnabled();
  });
});
