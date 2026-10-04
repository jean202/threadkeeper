import { FormEvent, useState } from 'react';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { ProviderType } from '@/types/thread';
import ImportDetail from '@/components/ImportDetail';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { formatTimestamp } from '@/lib/format';
import { CONNECTION_STATUS_LABEL, PROVIDER_LABEL, label } from '@/lib/labels';

const PROVIDERS: ProviderType[] = ['CODEX', 'CLAUDE', 'GEMINI', 'GROK'];

/**
 * The bridge reads Codex and Claude transcripts from disk itself; only the
 * other providers go through agent-state-migrator and need its path.
 */
function needsMigrator(provider: ProviderType): boolean {
  return provider !== 'CODEX' && provider !== 'CLAUDE';
}

export default function ProviderSettings() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [provider, setProvider] = useState<ProviderType>('CODEX');
  const [accountLabel, setAccountLabel] = useState('default');
  const [homePath, setHomePath] = useState('');
  const [migratorPath, setMigratorPath] = useState('');
  const [bridgePath, setBridgePath] = useState('');

  const resource = useAsyncResource(() => threadKeeperClient.listProviderConnections());

  const runAction = async (name: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      resource.reload();
      setNotice(typeof result === 'string' ? result : (done ?? null));
    } catch (err) {
      setError(describeApiError(err, `${name}에 실패했어요`));
    } finally {
      setBusy(null);
    }
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    runAction(
      '연결 추가',
      () => threadKeeperClient.createProviderConnection({ provider, accountLabel, homePath }),
      '연결을 추가했어요.',
    );
  };

  if (resource.loading) return <div>연동 정보를 불러오는 중...</div>;
  if (!resource.data) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>AI 도구 연동</h1>
        <LoadError
          error={resource.error ?? '연동 정보를 불러오지 못했어요'}
          code={resource.errorCode}
          failures={resource.failures}
          retrying={resource.retrying}
          onRetry={resource.reload}
        />
      </div>
    );
  }

  const connections = resource.data;

  return (
    <div style={{ padding: '20px', maxWidth: '760px' }}>
      <h1>AI 도구 연동</h1>
      <p>
        Codex와 Claude에서 작업한 대화(세션)를 가져와 스레드로 정리해요. 이 컴퓨터에 저장된 대화
        기록을 읽기만 하고, 원본은 바꾸지 않아요.
      </p>

      {error && <p role="alert">오류: {error}</p>}
      {notice && <p role="status">{notice}</p>}

      <section style={{ marginBottom: '30px' }}>
        <h2>연결된 도구 ({connections.length})</h2>
        {connections.length === 0 ? (
          <p>아직 연결된 도구가 없어요. 아래에서 추가해 주세요.</p>
        ) : (
          <ul>
            {connections.map((connection) => (
              <li key={connection.id} style={{ marginBottom: '14px' }}>
                <strong>
                  {label(PROVIDER_LABEL, connection.provider)}
                  {connection.accountLabel ? ` · ${connection.accountLabel}` : ''}
                </strong>{' '}
                — {label(CONNECTION_STATUS_LABEL, connection.status)}
                <div>홈 경로: {connection.homePath || '—'}</div>
                <div>마지막 가져오기: {formatTimestamp(connection.lastImportAt)}</div>
                <div>가져온 세션: {connection.importedSessionCount}개</div>
                {connection.lastErrorMessage && (
                  <div role="alert">마지막 오류: {connection.lastErrorMessage}</div>
                )}
                <ImportDetail connectionId={connection.id} />
                <button
                  onClick={() =>
                    runAction(
                      `${label(PROVIDER_LABEL, connection.provider)} 가져오기`,
                      async () => {
                        const imported = await threadKeeperClient.runProviderImport(connection.id, {
                          migratorPath: migratorPath.trim() || undefined,
                          bridgePath: bridgePath || undefined,
                          // Each connection imports only its own provider. Left
                          // unset, the api defaults to "codex,claude" for every
                          // connection, so running both filed each session twice.
                          target: connection.provider.toLowerCase(),
                          includeSensitive: false,
                        });
                        return `세션 ${imported.length}개를 가져왔어요.`;
                      },
                    )
                  }
                  disabled={busy !== null || (needsMigrator(connection.provider) && migratorPath.trim() === '')}
                  title={
                    needsMigrator(connection.provider) && migratorPath.trim() === ''
                      ? '이 도구는 아래 고급 설정에 agent-state-migrator 경로가 필요해요'
                      : undefined
                  }
                >
                  {busy === `${label(PROVIDER_LABEL, connection.provider)} 가져오기`
                    ? '가져오는 중...'
                    : '지금 가져오기'}
                </button>{' '}
                <button
                  onClick={() => {
                    // It deletes threads, so it is never one stray click away.
                    const confirmed = window.confirm(
                      `${label(PROVIDER_LABEL, connection.provider)} 연결로 가져온 스레드와 세션을 모두 지워요. ` +
                        '원본 대화 기록은 그대로 남아서 다시 가져올 수 있어요. 계속할까요?',
                    );
                    if (!confirmed) return;
                    runAction(`${label(PROVIDER_LABEL, connection.provider)} 초기화`, async () => {
                      const result = await threadKeeperClient.resetConnectionImports(connection.id);
                      return `스레드 ${result.threadsDeleted}개, 세션 ${result.sourceSessionsDeleted}개, 진행 기록 ${result.snapshotsDeleted}개를 지웠어요.`;
                    });
                  }}
                  disabled={busy !== null}
                >
                  가져온 데이터 초기화
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details style={{ marginBottom: '30px' }}>
        <summary>고급 설정 (Gemini·Grok 가져오기용)</summary>
        <p>
          Codex와 Claude는 이 설정 없이 가져올 수 있어요. 그 밖의 도구는 이 저장소 밖에 있는{' '}
          <code>agent-state-migrator</code>로 가져오기 때문에 그 경로가 필요해요.
        </p>
        <label htmlFor="migratorPath">agent-state-migrator 경로</label>
        <input
          id="migratorPath"
          value={migratorPath}
          onChange={(e) => setMigratorPath(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
          placeholder="/path/to/agent-state-migrator"
        />
        <label htmlFor="bridgePath">브리지 경로 (비워 두면 기본 위치 사용)</label>
        <input
          id="bridgePath"
          value={bridgePath}
          onChange={(e) => setBridgePath(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
          placeholder="/path/to/agent-state-migrator-bridge"
        />
      </details>

      <section>
        <h2>새 연결 추가</h2>
        <form onSubmit={onCreate}>
          <label htmlFor="provider">AI 도구</label>{' '}
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderType)}
          >
            {PROVIDERS.map((value) => (
              <option key={value} value={value}>
                {PROVIDER_LABEL[value]}
              </option>
            ))}
          </select>{' '}
          <label htmlFor="accountLabel">이름</label>{' '}
          <input
            id="accountLabel"
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            maxLength={100}
          />{' '}
          <label htmlFor="homePath">홈 경로</label>{' '}
          <input
            id="homePath"
            value={homePath}
            onChange={(e) => setHomePath(e.target.value)}
            maxLength={300}
            placeholder="/Users/사용자이름"
          />{' '}
          <button type="submit" disabled={busy !== null}>
            {busy === '연결 추가' ? '추가 중...' : '연결 추가'}
          </button>
        </form>
      </section>
    </div>
  );
}
