import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return {
    ...actual,
    threadKeeperClient: {
      listNotificationRules: vi.fn(),
      listNotificationEvents: vi.fn(),
      createNotificationRule: vi.fn(),
      updateNotificationRule: vi.fn(),
      deleteNotificationRule: vi.fn(),
      evaluateNotificationRules: vi.fn(),
      dispatchNotifications: vi.fn(),
      listProviderConnections: vi.fn(),
      createProviderConnection: vi.fn(),
      runProviderImport: vi.fn(),
      resetConnectionImports: vi.fn(),
    },
  };
});

import NotificationSettings from '@/pages/settings/notifications';
import ProviderSettings from '@/pages/settings/providers';
import { threadKeeperClient } from '@/api/client';
import { notificationEvent, notificationRule, providerConnection } from '@/test/fixtures';

const client = threadKeeperClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  client.listNotificationRules.mockResolvedValue([notificationRule]);
  client.listNotificationEvents.mockResolvedValue([notificationEvent]);
  client.listProviderConnections.mockResolvedValue([providerConnection]);
});

describe('notification settings', () => {
  it('lists rules with their delivery settings', async () => {
    render(<NotificationSettings />);

    // Scope to the Rules section: INACTIVITY also appears in the rule-type
    // dropdown and in the events list below.
    const rules = (await screen.findByRole('heading', { name: '규칙 (1)' })).closest('section')!;
    expect(rules).toHaveTextContent('오래 멈춘 스레드');
    expect(rules).toHaveTextContent('· 디스코드');
    expect(rules).toHaveTextContent('60분 후');
    expect(rules).toHaveTextContent('켜짐');
  });

  // PATCH is a partial update, so the toggle sends only the field it changes.
  // Echoing back the whole record would let a screen that never showed the
  // threshold overwrite it with whatever it happened to be holding.
  it('disables a rule by sending only the field it changes', async () => {
    client.updateNotificationRule.mockResolvedValue({ ...notificationRule, enabled: false });
    render(<NotificationSettings />);
    await screen.findByRole('heading', { name: '규칙 (1)' });

    await userEvent.click(screen.getByRole('button', { name: '끄기' }));

    await waitFor(() =>
      expect(client.updateNotificationRule).toHaveBeenCalledWith(1, { enabled: false }),
    );
  });

  it('deletes a rule', async () => {
    client.deleteNotificationRule.mockResolvedValue(undefined);
    render(<NotificationSettings />);
    await screen.findByRole('heading', { name: '규칙 (1)' });

    await userEvent.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(client.deleteNotificationRule).toHaveBeenCalledWith(1));
  });

  it('only asks for the fields the chosen rule type actually uses', async () => {
    render(<NotificationSettings />);
    await screen.findByRole('heading', { name: '규칙 (1)' });

    // INACTIVITY is the default and needs a threshold, not a time.
    expect(screen.getByLabelText('멈춘 시간 (분)')).toBeInTheDocument();
    expect(screen.queryByLabelText('브리핑 시각')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('알림 종류'), 'DAILY_BRIEFING');
    expect(screen.getByLabelText('브리핑 시각')).toBeInTheDocument();
    expect(screen.queryByLabelText('멈춘 시간 (분)')).not.toBeInTheDocument();

    // COMPLETION needs neither.
    await userEvent.selectOptions(screen.getByLabelText('알림 종류'), 'COMPLETION');
    expect(screen.queryByLabelText('브리핑 시각')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('멈춘 시간 (분)')).not.toBeInTheDocument();
  });

  it('creates a briefing rule with the scheduled time and no threshold', async () => {
    client.createNotificationRule.mockResolvedValue(notificationRule);
    render(<NotificationSettings />);
    await screen.findByRole('heading', { name: '규칙 (1)' });

    await userEvent.selectOptions(screen.getByLabelText('알림 종류'), 'DAILY_BRIEFING');
    await userEvent.click(screen.getByRole('button', { name: '규칙 추가' }));

    await waitFor(() =>
      expect(client.createNotificationRule).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleType: 'DAILY_BRIEFING',
          scheduledTime: '09:00',
          thresholdMinutes: null,
        }),
      ),
    );
  });

  it('reports how many notifications an evaluation queued', async () => {
    client.evaluateNotificationRules.mockResolvedValue({ queuedCount: 4 });
    render(<NotificationSettings />);
    await screen.findByRole('heading', { name: '규칙 (1)' });

    await userEvent.click(screen.getByRole('button', { name: '지금 확인' }));

    expect(await screen.findByRole('status')).toHaveTextContent('알림 4개를 대기열에 넣었어요.');
  });

  it('shows each event with its delivery status', async () => {
    render(<NotificationSettings />);

    expect(await screen.findByText(/오래 멈춘 스레드 · 디스코드 ·/)).toBeInTheDocument();
    expect(screen.getByText('대기 중')).toBeInTheDocument();
  });
});

describe('provider settings', () => {
  it('shows the ingestion status the screen is meant to report', async () => {
    render(<ProviderSettings />);

    expect(await screen.findByRole('heading', { name: '연결된 도구 (1)' })).toBeInTheDocument();
    expect(screen.getByText(/Codex · default/)).toBeInTheDocument();
    expect(screen.getByText(/가져온 세션: 3개/)).toBeInTheDocument();
    expect(screen.getByText(/홈 경로: \/home\/user/)).toBeInTheDocument();
  });

  it('surfaces an ingestion error when the last import failed', async () => {
    client.listProviderConnections.mockResolvedValue([
      { ...providerConnection, status: 'ERROR' as const, lastErrorMessage: 'migrator not found' },
    ]);
    render(<ProviderSettings />);

    expect(await screen.findByRole('alert')).toHaveTextContent('migrator not found');
  });

  it('imports Codex and Claude without asking for the migrator path', async () => {
    client.listProviderConnections.mockResolvedValue([
      providerConnection,
      { ...providerConnection, id: 2, provider: 'CLAUDE' as const },
    ]);
    client.runProviderImport.mockResolvedValue([{}, {}]);
    render(<ProviderSettings />);
    await screen.findByRole('heading', { name: '연결된 도구 (2)' });

    const buttons = screen.getAllByRole('button', { name: '지금 가져오기' });
    expect(buttons.every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);

    await userEvent.click(buttons[0]);
    await waitFor(() => expect(client.runProviderImport).toHaveBeenCalledTimes(1));
    // A blank path is left out entirely, not sent as an empty string.
    expect(client.runProviderImport.mock.calls[0][1].migratorPath).toBeUndefined();
    expect(await screen.findByRole('status')).toHaveTextContent('세션 2개를 가져왔어요.');
  });

  it('still needs the migrator path for a provider only the migrator can read', async () => {
    client.listProviderConnections.mockResolvedValue([
      { ...providerConnection, provider: 'GEMINI' as const },
    ]);
    render(<ProviderSettings />);
    await screen.findByRole('heading', { name: '연결된 도구 (1)' });

    expect(screen.getByRole('button', { name: '지금 가져오기' })).toBeDisabled();

    await userEvent.click(screen.getByText('고급 설정 (Gemini·Grok 가져오기용)'));
    await userEvent.type(screen.getByLabelText('agent-state-migrator 경로'), '/opt/migrator');
    expect(screen.getByRole('button', { name: '지금 가져오기' })).toBeEnabled();
  });

  it('imports only the provider of the connection whose button was pressed', async () => {
    client.listProviderConnections.mockResolvedValue([
      providerConnection,
      { ...providerConnection, id: 2, provider: 'CLAUDE' as const },
    ]);
    client.runProviderImport.mockResolvedValue([]);
    render(<ProviderSettings />);
    await screen.findByRole('heading', { name: '연결된 도구 (2)' });

    await userEvent.click(screen.getAllByRole('button', { name: '지금 가져오기' })[1]);

    await waitFor(() => expect(client.runProviderImport).toHaveBeenCalledTimes(1));
    expect(client.runProviderImport).toHaveBeenCalledWith(2, expect.objectContaining({ target: 'claude' }));
  });

  it('reports what a reset actually removed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    client.resetConnectionImports.mockResolvedValue({
      threadsDeleted: 2,
      sourceSessionsDeleted: 5,
      snapshotsDeleted: 7,
    });
    render(<ProviderSettings />);
    await screen.findByRole('heading', { name: '연결된 도구 (1)' });

    await userEvent.click(screen.getByRole('button', { name: '가져온 데이터 초기화' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '스레드 2개, 세션 5개, 진행 기록 7개를 지웠어요.',
    );
  });

  it('asks before a reset, and does nothing when declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ProviderSettings />);
    await screen.findByRole('heading', { name: '연결된 도구 (1)' });

    await userEvent.click(screen.getByRole('button', { name: '가져온 데이터 초기화' }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(client.resetConnectionImports).not.toHaveBeenCalled();
  });

  it('adds a connection', async () => {
    client.createProviderConnection.mockResolvedValue(providerConnection);
    render(<ProviderSettings />);
    await screen.findByRole('heading', { name: '연결된 도구 (1)' });

    await userEvent.selectOptions(screen.getByLabelText('AI 도구'), 'CLAUDE');
    await userEvent.click(screen.getByRole('button', { name: '연결 추가' }));

    await waitFor(() =>
      expect(client.createProviderConnection).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'CLAUDE' }),
      ),
    );
  });
});
