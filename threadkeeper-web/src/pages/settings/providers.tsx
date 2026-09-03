import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { ProviderType } from '@/types/thread';
import { ProviderConnectionResponse } from '@/types/settings';

const PROVIDERS: ProviderType[] = ['CODEX', 'CLAUDE', 'GEMINI', 'GPT'];

export default function ProviderSettings() {
  const [connections, setConnections] = useState<ProviderConnectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [provider, setProvider] = useState<ProviderType>('CODEX');
  const [accountLabel, setAccountLabel] = useState('default');
  const [homePath, setHomePath] = useState('');
  const [migratorPath, setMigratorPath] = useState('');
  const [bridgePath, setBridgePath] = useState('');

  const load = useCallback(async () => {
    setConnections(await threadKeeperClient.listProviderConnections());
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        await load();
      } catch (err) {
        setError(describeApiError(err, 'Failed to load provider connections'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [load]);

  const runAction = async (name: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      await load();
      setNotice(typeof result === 'string' ? result : (done ?? null));
    } catch (err) {
      setError(describeApiError(err, `Failed to ${name}`));
    } finally {
      setBusy(null);
    }
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    runAction(
      'add the connection',
      () => threadKeeperClient.createProviderConnection({ provider, accountLabel, homePath }),
      'Connection added.',
    );
  };

  if (loading) return <div>Loading provider connections...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '760px' }}>
      <Link href="/">← Back</Link>
      <h1>Provider Connections</h1>
      <p>Where session artifacts are imported from, and how the last import went.</p>

      {error && <p role="alert">Error: {error}</p>}
      {notice && <p role="status">{notice}</p>}

      <section style={{ marginBottom: '30px' }}>
        <h2>Configured providers ({connections.length})</h2>
        {connections.length === 0 ? (
          <p>No connections yet.</p>
        ) : (
          <ul>
            {connections.map((connection) => (
              <li key={connection.id} style={{ marginBottom: '14px' }}>
                <strong>
                  {connection.provider}
                  {connection.accountLabel ? ` / ${connection.accountLabel}` : ''}
                </strong>{' '}
                — {connection.status}
                <div>Home path: {connection.homePath || '—'}</div>
                <div>
                  Last import:{' '}
                  {connection.lastImportAt
                    ? new Date(connection.lastImportAt).toLocaleString()
                    : 'never'}
                </div>
                <div>Imported sessions: {connection.importedSessionCount}</div>
                {connection.lastErrorMessage && (
                  <div role="alert">Last error: {connection.lastErrorMessage}</div>
                )}
                <button
                  onClick={() =>
                    runAction(
                      `run import ${connection.id}`,
                      async () => {
                        const imported = await threadKeeperClient.runProviderImport(connection.id, {
                          migratorPath,
                          bridgePath: bridgePath || undefined,
                          includeSensitive: false,
                        });
                        return `Imported ${imported.length} session(s).`;
                      },
                    )
                  }
                  disabled={busy !== null || migratorPath.trim() === ''}
                  title={
                    migratorPath.trim() === ''
                      ? 'Set the agent-state-migrator path below first'
                      : undefined
                  }
                >
                  {busy === `run import ${connection.id}` ? 'Importing...' : 'Run Import'}
                </button>{' '}
                <button
                  onClick={() =>
                    runAction(`reset imports ${connection.id}`, async () => {
                      const result = await threadKeeperClient.resetConnectionImports(connection.id);
                      return `Removed ${result.threadsDeleted} thread(s), ${result.sourceSessionsDeleted} session(s), ${result.snapshotsDeleted} snapshot(s).`;
                    })
                  }
                  disabled={busy !== null}
                >
                  Reset Imports
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Import paths</h2>
        <p>
          Importing shells out to <code>agent-state-migrator</code>, which lives outside this repo,
          so its path has to be supplied here. Codex sessions are read by the bridge directly; other
          providers need the migrator.
        </p>
        <label htmlFor="migratorPath">agent-state-migrator path</label>
        <input
          id="migratorPath"
          value={migratorPath}
          onChange={(e) => setMigratorPath(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
          placeholder="/path/to/agent-state-migrator"
        />
        <label htmlFor="bridgePath">bridge path (optional)</label>
        <input
          id="bridgePath"
          value={bridgePath}
          onChange={(e) => setBridgePath(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
          placeholder="/path/to/agent-state-migrator-bridge"
        />
      </section>

      <section>
        <h2>Add a connection</h2>
        <form onSubmit={onCreate}>
          <label htmlFor="provider">Provider</label>{' '}
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderType)}
          >
            {PROVIDERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>{' '}
          <label htmlFor="accountLabel">Label</label>{' '}
          <input
            id="accountLabel"
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            maxLength={100}
          />{' '}
          <label htmlFor="homePath">Home path</label>{' '}
          <input
            id="homePath"
            value={homePath}
            onChange={(e) => setHomePath(e.target.value)}
            maxLength={300}
            placeholder="/Users/you"
          />{' '}
          <button type="submit" disabled={busy !== null}>
            {busy === 'add the connection' ? 'Adding...' : 'Add Connection'}
          </button>
        </form>
      </section>
    </div>
  );
}
