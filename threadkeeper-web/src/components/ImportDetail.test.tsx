import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return { ...actual, threadKeeperClient: { getLatestImport: vi.fn() } };
});

import ImportDetail from '@/components/ImportDetail';
import { threadKeeperClient } from '@/api/client';
import { latestImport } from '@/test/fixtures';

const client = threadKeeperClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  client.getLatestImport.mockResolvedValue(latestImport);
});

describe('import detail', () => {
  it('fetches nothing until it is opened', () => {
    render(<ImportDetail connectionId={1} />);

    expect(client.getLatestImport).not.toHaveBeenCalled();
  });

  it('shows linked threads separately from session count', async () => {
    const user = userEvent.setup();
    render(<ImportDetail connectionId={1} />);

    await user.click(screen.getByRole('button', { name: 'Import details' }));

    expect(await screen.findByText('Linked threads: 2')).toBeInTheDocument();
    expect(screen.getByText('Sessions imported: 3')).toBeInTheDocument();
    expect(client.getLatestImport).toHaveBeenCalledWith(1);
  });

  it('says so when the last run brought nothing new', async () => {
    const user = userEvent.setup();
    render(<ImportDetail connectionId={1} />);

    await user.click(screen.getByRole('button', { name: 'Import details' }));

    expect(
      await screen.findByText(/the last run brought nothing new/),
    ).toBeInTheDocument();
  });

  // The connection stamps its timestamp after the rows land, so a productive
  // run still leaves the two a few milliseconds apart -- measured at ~3ms
  // against a live API. Comparing them for equality would cry wolf every time.
  it('stays quiet when the run did bring content', async () => {
    client.getLatestImport.mockResolvedValue({
      ...latestImport,
      lastImportAt: '2026-08-04T06:00:00.004Z',
      latestSessionImportedAt: '2026-08-04T06:00:00.001Z',
    });
    const user = userEvent.setup();
    render(<ImportDetail connectionId={1} />);

    await user.click(screen.getByRole('button', { name: 'Import details' }));

    await screen.findByText('Linked threads: 2');
    expect(screen.queryByText(/brought nothing new/)).not.toBeInTheDocument();
  });

  it('lists recent sessions with a link to the thread', async () => {
    const user = userEvent.setup();
    render(<ImportDetail connectionId={1} />);

    await user.click(screen.getByRole('button', { name: 'Import details' }));

    expect(await screen.findByText(/Contract fix session/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'thread 1' })).toHaveAttribute('href', '/threads/1');
  });

  it('refetches on reopen, since an import may have run since', async () => {
    const user = userEvent.setup();
    render(<ImportDetail connectionId={1} />);

    await user.click(screen.getByRole('button', { name: 'Import details' }));
    await screen.findByText('Linked threads: 2');
    await user.click(screen.getByRole('button', { name: 'Hide import details' }));
    await user.click(screen.getByRole('button', { name: 'Import details' }));

    await screen.findByText('Linked threads: 2');
    expect(client.getLatestImport).toHaveBeenCalledTimes(2);
  });

  it('surfaces a failure instead of showing stale nothing', async () => {
    client.getLatestImport.mockRejectedValue(new Error('Network Error'));
    const user = userEvent.setup();
    render(<ImportDetail connectionId={1} />);

    await user.click(screen.getByRole('button', { name: 'Import details' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network Error');
  });

  it('flags a run that found nothing even though sessions exist', async () => {
    client.getLatestImport.mockResolvedValue({
      ...latestImport,
      lastImportAt: '2026-08-04T06:00:00Z',
      latestSessionImportedAt: null,
    });
    const user = userEvent.setup();
    render(<ImportDetail connectionId={1} />);

    await user.click(screen.getByRole('button', { name: 'Import details' }));

    expect(await screen.findByText(/the last run brought nothing new/)).toBeInTheDocument();
  });

  it('handles a connection that has never imported', async () => {
    client.getLatestImport.mockResolvedValue({
      ...latestImport,
      importedSessionCount: 0,
      linkedThreadCount: 0,
      lastImportAt: null,
      latestSessionImportedAt: null,
      recentSessions: [],
    });
    const user = userEvent.setup();
    render(<ImportDetail connectionId={1} />);

    await user.click(screen.getByRole('button', { name: 'Import details' }));

    expect(await screen.findByText('No sessions imported yet.')).toBeInTheDocument();
    expect(screen.getByText('Last run attempted: never')).toBeInTheDocument();
  });
});
