import { useState } from 'react';
import { threadKeeperClient } from '@/api/client';
import NavBar from '@/components/NavBar';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { ProviderType } from '@/types/thread';
import {
  CreateProviderConnectionRequest,
  LatestImportResponse,
  ProviderConnectionResponse,
  ProviderConnectionStatus,
  RunProviderImportRequest,
} from '@/types/provider';
import { formatTimestamp } from '@/lib/format';

const PROVIDERS: ProviderType[] = ['CODEX', 'CLAUDE', 'GEMINI', 'GPT'];

const STATUS_COLORS: Record<ProviderConnectionStatus, string> = {
  ACTIVE: '#047857',
  ERROR: '#b91c1c',
  DISCONNECTED: '#6b7280',
};

const EMPTY_NEW_CONNECTION: CreateProviderConnectionRequest = {
  provider: 'CODEX',
  accountLabel: 'default',
  homePath: '',
};

const EMPTY_IMPORT_FORM: RunProviderImportRequest = {
  migratorPath: '',
  bridgePath: '',
  profile: 'full',
  target: 'codex,claude',
  includeSensitive: false,
};

function orNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function ConnectionCard({
  connection,
  latest,
  busy,
  onRunImport,
  onReset,
}: {
  connection: ProviderConnectionResponse;
  latest: LatestImportResponse | undefined;
  busy: boolean;
  onRunImport: (connectionId: number, form: RunProviderImportRequest) => Promise<void>;
  onReset: (connectionId: number) => Promise<void>;
}) {
  const [form, setForm] = useState<RunProviderImportRequest>(EMPTY_IMPORT_FORM);
  const [showImport, setShowImport] = useState(false);

  return (
    <li>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{connection.provider}</strong>
        <span style={{ color: '#666' }}>{connection.accountLabel || '(label 없음)'}</span>
        <span style={{ color: STATUS_COLORS[connection.status], fontWeight: 600 }}>
          {connection.status}
        </span>
        <span style={{ color: '#888', fontSize: '12px' }}>#{connection.id}</span>
      </div>

      <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>
        home: {connection.homePath || '-'}
      </div>

      <div style={{ marginTop: '8px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#888' }}>마지막 import</div>
          <div>{formatTimestamp(connection.lastImportAt)}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#888' }}>가져온 세션</div>
          <div>{latest ? latest.importedSessionCount : '…'}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#888' }}>연결된 스레드</div>
          <div>{latest ? latest.linkedThreadCount : '…'}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#888' }}>최근 세션 시각</div>
          <div>{latest ? formatTimestamp(latest.latestSessionImportedAt) : '…'}</div>
        </div>
      </div>

      {connection.lastErrorMessage && (
        <p
          style={{
            marginTop: '8px',
            padding: '8px',
            background: '#fef2f2',
            color: '#b91c1c',
            borderRadius: '4px',
            fontSize: '13px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {connection.lastErrorMessage}
        </p>
      )}

      {latest && latest.recentSessions.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '13px' }}>
          <div style={{ color: '#888', fontSize: '12px' }}>최근 가져온 세션</div>
          {latest.recentSessions.map((session) => (
            <div key={session.id} style={{ color: '#444' }}>
              · {session.title || session.providerSessionKey} ({formatTimestamp(session.importedAt)})
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setShowImport(!showImport)} disabled={busy}>
          {showImport ? 'import 닫기' : 'import 실행'}
        </button>
        <button
          onClick={() => onReset(connection.id)}
          disabled={busy}
          style={{ backgroundColor: '#b91c1c' }}
        >
          import 초기화
        </button>
      </div>

      {showImport && (
        <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
          <label style={{ fontSize: '13px' }}>
            <div>migratorPath (필수, agent-state-migrator 로컬 경로)</div>
            <input
              type="text"
              value={form.migratorPath}
              onChange={(e) => setForm({ ...form, migratorPath: e.target.value })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ fontSize: '13px' }}>
            <div>bridgePath (선택)</div>
            <input
              type="text"
              value={form.bridgePath ?? ''}
              onChange={(e) => setForm({ ...form, bridgePath: e.target.value })}
              style={{ width: '100%' }}
            />
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '13px' }}>
              <div>profile</div>
              <input
                type="text"
                value={form.profile ?? ''}
                onChange={(e) => setForm({ ...form, profile: e.target.value })}
              />
            </label>
            <label style={{ fontSize: '13px' }}>
              <div>target</div>
              <input
                type="text"
                value={form.target ?? ''}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              />
            </label>
            <label
              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <input
                type="checkbox"
                checked={form.includeSensitive}
                onChange={(e) => setForm({ ...form, includeSensitive: e.target.checked })}
              />
              includeSensitive
            </label>
          </div>
          <div>
            <button
              onClick={() => onRunImport(connection.id, form)}
              disabled={busy || form.migratorPath.trim() === ''}
            >
              실행
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function Connections() {
  const [newConnection, setNewConnection] =
    useState<CreateProviderConnectionRequest>(EMPTY_NEW_CONNECTION);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error: loadError, loading, failures, retrying, reload } = useAsyncResource(
    async () => {
      const connections = await threadKeeperClient.listProviderConnections();

      // One import summary per connection; a single failure must not blank the whole page.
      const summaries = await Promise.all(
        connections.map(async (connection) => {
          try {
            return await threadKeeperClient.getLatestImport(connection.id);
          } catch {
            return null;
          }
        }),
      );

      return {
        connections,
        latestByConnection: new Map(
          summaries
            .filter((summary): summary is LatestImportResponse => summary !== null)
            .map((summary) => [summary.connectionId, summary]),
        ),
      };
    },
  );

  const connections = data?.connections ?? [];
  const latestByConnection = data?.latestByConnection ?? new Map<number, LatestImportResponse>();

  const runAction = async (action: () => Promise<string>) => {
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      setMessage(await action());
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () =>
    runAction(async () => {
      await threadKeeperClient.createProviderConnection({
        provider: newConnection.provider,
        accountLabel: orNull(newConnection.accountLabel),
        homePath: orNull(newConnection.homePath),
      });
      setNewConnection(EMPTY_NEW_CONNECTION);
      return '연결을 등록했습니다.';
    });

  const handleRunImport = (connectionId: number, form: RunProviderImportRequest) =>
    runAction(async () => {
      const imported = await threadKeeperClient.runProviderImport(connectionId, {
        migratorPath: form.migratorPath.trim(),
        bridgePath: orNull(form.bridgePath),
        profile: orNull(form.profile),
        target: orNull(form.target),
        includeSensitive: form.includeSensitive,
      });
      return `${imported.length}개 세션을 가져왔습니다.`;
    });

  const handleReset = (connectionId: number) => {
    const confirmed = window.confirm(
      `연결 #${connectionId}의 import를 초기화합니다.\n` +
        '이 연결로 가져온 소스 세션과, 다른 연결에 묶이지 않은 스레드 및 스냅샷이 삭제됩니다.\n' +
        '되돌릴 수 없습니다. 계속할까요?',
    );
    if (!confirmed) return Promise.resolve();

    return runAction(async () => {
      const result = await threadKeeperClient.resetProviderImports(connectionId);
      return `스레드 ${result.threadsDeleted}건, 세션 ${result.sourceSessionsDeleted}건, 스냅샷 ${result.snapshotsDeleted}건을 삭제했습니다.`;
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <NavBar current="/connections" />
      <h1>프로바이더 연결</h1>

      {message && <p style={{ color: '#047857' }}>{message}</p>}
      {actionError && <p style={{ color: '#b91c1c' }}>{actionError}</p>}
      {loadError && (
        <LoadError error={loadError} failures={failures} retrying={retrying} onRetry={reload} />
      )}
      {loading && <p>Loading...</p>}

      <section style={{ marginBottom: '20px' }}>
        <h2>연결 ({connections.length})</h2>
        {connections.length === 0 ? (
          <p style={{ color: '#888' }}>등록된 연결이 없습니다.</p>
        ) : (
          <ul>
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                latest={latestByConnection.get(connection.id)}
                busy={busy}
                onRunImport={handleRunImport}
                onReset={handleReset}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>연결 등록</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px' }}>
            <div>provider</div>
            <select
              value={newConnection.provider}
              onChange={(e) =>
                setNewConnection({ ...newConnection, provider: e.target.value as ProviderType })
              }
            >
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '13px' }}>
            <div>accountLabel</div>
            <input
              type="text"
              value={newConnection.accountLabel ?? ''}
              onChange={(e) =>
                setNewConnection({ ...newConnection, accountLabel: e.target.value })
              }
            />
          </label>
          <label style={{ fontSize: '13px', flex: 1, minWidth: '260px' }}>
            <div>homePath</div>
            <input
              type="text"
              placeholder="/Users/me"
              value={newConnection.homePath ?? ''}
              onChange={(e) => setNewConnection({ ...newConnection, homePath: e.target.value })}
              style={{ width: '100%' }}
            />
          </label>
          <button onClick={handleCreate} disabled={busy}>
            등록
          </button>
        </div>
      </section>
    </div>
  );
}
