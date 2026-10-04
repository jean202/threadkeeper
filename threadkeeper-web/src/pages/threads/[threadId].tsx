import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { ProviderType, ThreadDetailResponse } from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import PortfolioReadinessBadge from '@/components/PortfolioReadinessBadge';
import DriftWarning from '@/components/DriftWarning';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { formatDate, formatTimestamp } from '@/lib/format';
import {
  CHANNEL_LABEL,
  DELIVERY_LABEL,
  HANDOFF_STATUS_LABEL,
  PRIORITY_LABEL,
  PROVIDER_LABEL,
  RULE_TYPE_LABEL,
  SNAPSHOT_LABEL,
  STATUS_LABEL,
  label,
} from '@/lib/labels';

const PROVIDERS: ProviderType[] = ['CLAUDE', 'CODEX', 'GEMINI', 'GROK'];

interface ThreadDetailData {
  thread: ThreadDetailResponse;
  readiness: PortfolioReadiness | undefined;
}

export default function ThreadDetail() {
  const router = useRouter();
  const { threadId } = router.query;

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // null means "not edited", so the field shows whatever the server last said.
  // Deriving it beats syncing it in an effect, which would cascade a render.
  const [nextActionEdit, setNextActionEdit] = useState<string | null>(null);
  const [progressNote, setProgressNote] = useState('');
  const [targetProvider, setTargetProvider] = useState<ProviderType>('CLAUDE');

  // Disabled until the router has filled in the dynamic param, so the hook does
  // not fire a request for thread "NaN".
  const resource = useAsyncResource<ThreadDetailData>(
    async () => {
      const [thread, readinessMap] = await Promise.all([
        threadKeeperClient.getThread(Number(threadId)),
        threadKeeperClient.getPortfolioReadiness(),
      ]);
      return { thread, readiness: readinessMap.get(thread.projectKey) };
    },
    [threadId],
    Boolean(threadId),
  );

  const thread = resource.data?.thread ?? null;
  const readiness = resource.data?.readiness;
  const nextActionDraft = nextActionEdit ?? thread?.currentNextAction ?? '';

  /** Runs one mutation, then refetches so the page reflects server truth. */
  const runAction = async (name: string, action: () => Promise<unknown>) => {
    setBusy(name);
    setActionError(null);
    try {
      await action();
      setNextActionEdit(null);
      resource.reload();
    } catch (err) {
      setActionError(describeApiError(err, `${name}에 실패했어요`));
    } finally {
      setBusy(null);
    }
  };

  if (resource.loading) return <div>불러오는 중...</div>;
  if (!thread) {
    return (
      <div style={{ padding: '20px' }}>
        <LoadError
          error={resource.error ?? '스레드를 찾을 수 없어요'}
          code={resource.errorCode}
          failures={resource.failures}
          retrying={resource.retrying}
          onRetry={resource.reload}
        />
      </div>
    );
  }

  const latestHandoff = thread.handoffs.length > 0 ? thread.handoffs[0] : null;
  const id = thread.id;

  return (
    <div style={{ padding: '20px' }}>
      <h1>{thread.title}</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2>개요</h2>
        <p><strong>상태:</strong> {label(STATUS_LABEL, thread.status)}</p>
        <p><strong>우선순위:</strong> {label(PRIORITY_LABEL, thread.priority)}</p>
        <p>
          <strong>방향:</strong>{' '}
          <DriftWarning driftStatus={thread.driftStatus} driftScore={thread.driftScore} />
        </p>
        {readiness && (
          <p><strong>포트폴리오:</strong> <PortfolioReadinessBadge readiness={readiness} /></p>
        )}
        <p><strong>만든 날:</strong> {formatDate(thread.createdAt)}</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>목표와 맥락</h2>
        <p><strong>처음 의도:</strong> {thread.originalIntent}</p>
        <p><strong>오늘의 목표:</strong> {thread.todayGoal ?? '—'}</p>
        <p><strong>완료 조건:</strong> {thread.doneCondition ?? '—'}</p>
        <p><strong>다음 할 일:</strong> {thread.currentNextAction ?? '—'}</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>작업</h2>
        {actionError && <p role="alert">오류: {actionError}</p>}

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="nextAction"><strong>다음 할 일 정하기</strong></label>
          <textarea
            id="nextAction"
            value={nextActionDraft}
            onChange={(e) => setNextActionEdit(e.target.value)}
            maxLength={2000}
            rows={2}
            style={{ width: '100%', padding: '8px' }}
            placeholder="돌아왔을 때 바로 할 구체적인 한 가지"
          />
          <button
            onClick={() =>
              runAction('다음 할 일 저장', () =>
                threadKeeperClient.updateNextAction(id, nextActionDraft),
              )
            }
            disabled={busy !== null || nextActionDraft.trim() === ''}
          >
            {busy === '다음 할 일 저장' ? '저장 중...' : '다음 할 일 저장'}
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="progressNote"><strong>진행 기록 남기기</strong></label>
          <textarea
            id="progressNote"
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '8px' }}
            placeholder="지난번 이후 무엇이 바뀌었나요?"
          />
          <button
            onClick={() =>
              runAction('진행 기록 추가', async () => {
                await threadKeeperClient.createSnapshot(id, {
                  snapshotType: 'PROGRESS',
                  summary: progressNote,
                });
                setProgressNote('');
              })
            }
            disabled={busy !== null || progressNote.trim() === ''}
          >
            {busy === '진행 기록 추가' ? '저장 중...' : '기록 추가'}
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="targetProvider"><strong>핸드오프 초안 만들기</strong></label>{' '}
          <select
            id="targetProvider"
            value={targetProvider}
            onChange={(e) => setTargetProvider(e.target.value as ProviderType)}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABEL[provider]}
              </option>
            ))}
          </select>{' '}
          <button
            onClick={() =>
              runAction('핸드오프 초안 생성', () =>
                threadKeeperClient.generateHandoffDraft(id, { targetProvider }),
              )
            }
            disabled={busy !== null}
          >
            {busy === '핸드오프 초안 생성' ? '만드는 중...' : '핸드오프 만들기'}
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => runAction('방향 다시 평가', () => threadKeeperClient.evaluateDrift(id))}
            disabled={busy !== null}
          >
            {busy === '방향 다시 평가' ? '평가 중...' : '방향 다시 평가'}
          </button>
        </div>

        <div>
          <button
            onClick={() =>
              runAction('완료 처리', () =>
                threadKeeperClient.updateThreadStatus(id, 'COMPLETED'),
              )
            }
            disabled={busy !== null || thread.status === 'COMPLETED'}
          >
            {busy === '완료 처리' ? '저장 중...' : '완료로 표시'}
          </button>{' '}
          {thread.status !== 'ACTIVE' && (
            <button
              onClick={() =>
                runAction('다시 열기', () => threadKeeperClient.updateThreadStatus(id, 'ACTIVE'))
              }
              disabled={busy !== null}
            >
              {busy === '다시 열기' ? '저장 중...' : '다시 열기'}
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>원본 세션 ({thread.sourceSessions.length})</h2>
        {thread.sourceSessions.length === 0 ? (
          <p>연결된 세션이 없어요</p>
        ) : (
          <ul>
            {thread.sourceSessions.map((session) => (
              <li key={session.id}>
                {session.title ?? session.providerSessionKey} ({label(PROVIDER_LABEL, session.provider)}
                {session.sourceType ? ` / ${session.sourceType}` : ''})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>진행 기록 ({thread.snapshots.length})</h2>
        {thread.snapshots.length === 0 ? (
          <p>진행 기록이 없어요</p>
        ) : (
          <ul>
            {thread.snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                {label(SNAPSHOT_LABEL, snapshot.snapshotType)} - {formatTimestamp(snapshot.createdAt)}
                <div>{snapshot.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>핸드오프</h2>
        {!latestHandoff ? (
          <p>
            아직 핸드오프가 없어요.{' '}
            <Link href={`/threads/${thread.id}/handoff`}>초안 만들기</Link>
          </p>
        ) : (
          <div>
            <p><strong>상태:</strong> {label(HANDOFF_STATUS_LABEL, latestHandoff.status)}</p>
            <p><strong>넘겨받을 AI 도구:</strong> {label(PROVIDER_LABEL, latestHandoff.targetProvider)}</p>
            <p><strong>이유:</strong> {latestHandoff.reason ?? '—'}</p>
            <p><strong>한 일:</strong> {latestHandoff.whatChanged ?? '—'}</p>
            <p><strong>막힌 점:</strong> {latestHandoff.blockers ?? '—'}</p>
            <p><strong>다음 할 일:</strong> {latestHandoff.nextAction ?? '—'}</p>
            <Link href={`/threads/${thread.id}/handoff`}>핸드오프 보기/수정</Link>
          </div>
        )}
      </section>

      <section>
        <h2>알림 ({thread.notificationEvents.length})</h2>
        {thread.notificationEvents.length === 0 ? (
          <p>알림이 없어요</p>
        ) : (
          <ul>
            {thread.notificationEvents.slice(0, 5).map((event) => (
              <li key={event.id}>
                {label(RULE_TYPE_LABEL, event.eventType)} ({label(CHANNEL_LABEL, event.channel)} / {label(DELIVERY_LABEL, event.deliveryStatus)}) -{' '}
                {formatTimestamp(event.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
