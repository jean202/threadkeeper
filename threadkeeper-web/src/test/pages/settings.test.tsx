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
    const rules = (await screen.findByRole('heading', { name: 'Rules (1)' })).closest('section')!;
    expect(rules).toHaveTextContent('INACTIVITY');
    expect(rules).toHaveTextContent('via DISCORD');
    expect(rules).toHaveTextContent('after 60m');
    expect(rules).toHaveTextContent('enabled');
  });

  // PATCH is a partial update, so the toggle sends only the field it changes.
  // Echoing back the whole record would let a screen that never showed the
  // threshold overwrite it with whatever it happened to be holding.
  it('disables a rule by sending only the field it changes', async () => {
    client.updateNotificationRule.mockResolvedValue({ ...notificationRule, enabled: false });
    render(<NotificationSettings />);
    await screen.findByRole('heading', { name: 'Rules (1)' });

    await userEvent.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() =>
      expect(client.updateNotificationRule).toHaveBeenCalledWith(1, { enabled: false }),
    );
  });

  it('deletes a rule', async () => {
    client.deleteNotificationRule.mockResolvedValue(undefined);
    render(<NotificationSettings />);
    await screen.findByRole('heading', { name: 'Rules (1)' });

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(client.deleteNotificationRule).toHaveBeenCalledWith(1));
  });

  it('only asks for the fields the chosen rule type actually uses', async () => {
    render(<NotificationSettings />);
    await screen.findByRole('heading', { name: 'Rules (1)' });

    // INACTIVITY is the default and needs a threshold, not a time.
    expect(screen.getByLabelText('Inactive after (minutes)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Briefing time')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Rule type'), 'DAILY_BRIEFING');
    expect(screen.getByLabelText('Briefing time')).toBeInTheDocument();
    expect(screen.queryByLabelText('Inactive after (minutes)')).not.toBeInTheDocument();

    // COMPLETION needs neither.
    await userEvent.selectOptions(screen.getByLabelText('Rule type'), 'COMPLETION');
    expect(screen.queryByLabelText('Briefing time')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Inactive after (minutes)')).not.toBeInTheDocument();
  });

  it('creates a briefing rule with the scheduled time and no threshold', async () => {
    client.createNotificationRule.mockResolvedValue(notificationRule);
    render(<NotificationSettings />);
    await screen.findByRole('heading', { name: 'Rules (1)' });

    await userEvent.selectOptions(screen.getByLabelText('Rule type'), 'DAILY_BRIEFING');
    await userEvent.click(screen.getByRole('button', { name: 'Add Rule' }));

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
    await screen.findByRole('heading', { name: 'Rules (1)' });

    await userEvent.click(screen.getByRole('button', { name: 'Evaluate now' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Queued 4 notification(s).');
  });

  it('shows each event with its delivery status', async () => {
    render(<NotificationSettings />);

    expect(await screen.findByText(/INACTIVITY · DISCORD ·/)).toBeInTheDocument();
    expect(screen.getByText('QUEUED')).toBeInTheDocument();
  });
});

describe('provider settings', () => {
  it('shows the ingestion status the screen is meant to report', async () => {
    render(<ProviderSettings />);

    expect(await screen.findByRole('heading', { name: 'Configured providers (1)' })).toBeInTheDocument();
    expect(screen.getByText(/CODEX \/ default/)).toBeInTheDocument();
    expect(screen.getByText(/Imported sessions: 3/)).toBeInTheDocument();
    expect(screen.getByText(/Home path: \/home\/user/)).toBeInTheDocument();
  });

  it('surfaces an ingestion error when the last import failed', async () => {
    client.listProviderConnections.mockResolvedValue([
      { ...providerConnection, status: 'ERROR' as const, lastErrorMessage: 'migrator not found' },
    ]);
    render(<ProviderSettings />);

    expect(await screen.findByRole('alert')).toHaveTextContent('migrator not found');
  });

  it('will not run an import until the external migrator path is supplied', async () => {
    render(<ProviderSettings />);
    await screen.findByRole('heading', { name: 'Configured providers (1)' });

    expect(screen.getByRole('button', { name: 'Run Import' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('agent-state-migrator path'), '/opt/migrator');
    expect(screen.getByRole('button', { name: 'Run Import' })).toBeEnabled();
  });

  it('reports what a reset actually removed', async () => {
    client.resetConnectionImports.mockResolvedValue({
      threadsDeleted: 2,
      sourceSessionsDeleted: 5,
      snapshotsDeleted: 7,
    });
    render(<ProviderSettings />);
    await screen.findByRole('heading', { name: 'Configured providers (1)' });

    await userEvent.click(screen.getByRole('button', { name: 'Reset Imports' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Removed 2 thread(s), 5 session(s), 7 snapshot(s).',
    );
  });

  it('adds a connection', async () => {
    client.createProviderConnection.mockResolvedValue(providerConnection);
    render(<ProviderSettings />);
    await screen.findByRole('heading', { name: 'Configured providers (1)' });

    await userEvent.selectOptions(screen.getByLabelText('Provider'), 'CLAUDE');
    await userEvent.click(screen.getByRole('button', { name: 'Add Connection' }));

    await waitFor(() =>
      expect(client.createProviderConnection).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'CLAUDE' }),
      ),
    );
  });
});
