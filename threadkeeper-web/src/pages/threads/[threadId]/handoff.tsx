import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { HandoffResponse, ProviderType, ThreadDetailResponse } from '@/types/thread';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { HANDOFF_STATUS_LABEL, PROVIDER_LABEL, STATUS_LABEL, label } from '@/lib/labels';

const PROVIDERS: ProviderType[] = ['CLAUDE', 'CODEX', 'GEMINI', 'GROK'];

const fieldStyle = { width: '100%', padding: '8px', marginBottom: '12px' } as const;

/** The editable body of a handoff, kept as separate fields because that is how the API stores it. */
interface DraftFields {
  targetProvider: ProviderType;
  reason: string;
  whatChanged: string;
  blockers: string;
  nextAction: string;
  filesNote: string;
}

function toFields(handoff: HandoffResponse): DraftFields {
  return {
    targetProvider: handoff.targetProvider,
    reason: handoff.reason ?? '',
    whatChanged: handoff.whatChanged ?? '',
    blockers: handoff.blockers ?? '',
    nextAction: handoff.nextAction ?? '',
    filesNote: handoff.filesNote ?? '',
  };
}

/** Empty textareas mean "no content", which the API stores as null rather than "". */
function toPayload(fields: DraftFields) {
  const blankToNull = (value: string) => (value.trim() === '' ? null : value);
  return {
    targetProvider: fields.targetProvider,
    reason: blankToNull(fields.reason),
    whatChanged: blankToNull(fields.whatChanged),
    blockers: blankToNull(fields.blockers),
    nextAction: blankToNull(fields.nextAction),
    filesNote: blankToNull(fields.filesNote),
  };
}

export default function HandoffComposer() {
  const router = useRouter();
  const { threadId } = router.query;
  // null means "not edited", so the form shows the handoff as the server has it.
  // Deriving beats syncing in an effect, which would cascade a render.
  const [edits, setEdits] = useState<DraftFields | null>(null);
  const [newDraftProvider, setNewDraftProvider] = useState<ProviderType>('CLAUDE');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resource = useAsyncResource<ThreadDetailResponse>(
    () => threadKeeperClient.getThread(Number(threadId)),
    [threadId],
    Boolean(threadId),
  );

  const thread: ThreadDetailResponse | null = resource.data ?? null;
  const handoff: HandoffResponse | null =
    thread && thread.handoffs.length > 0 ? thread.handoffs[0] : null;
  const fields: DraftFields | null = edits ?? (handoff ? toFields(handoff) : null);

  const runAction = async (name: string, action: () => Promise<unknown>, done: string) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await action();
      setEdits(null);
      resource.reload();
      setNotice(done);
    } catch (err) {
      setError(describeApiError(err, `${name}에 실패했어요`));
    } finally {
      setBusy(null);
    }
  };

  const update = (patch: Partial<DraftFields>) =>
    setEdits((current) => {
      const base = current ?? (handoff ? toFields(handoff) : null);
      return base ? { ...base, ...patch } : base;
    });

  if (resource.loading) return <div>불러오는 중...</div>;
  if (!thread) {
    return (
      <div style={{ padding: '20px' }}>
        <LoadError
          error={resource.error ?? error ?? '스레드를 찾을 수 없어요'}
          code={resource.errorCode}
          failures={resource.failures}
          retrying={resource.retrying}
          onRetry={resource.reload}
        />
      </div>
    );
  }

  const sourceSession = handoff?.sourceSessionId
    ? thread.sourceSessions.find((session) => session.id === handoff.sourceSessionId)
    : undefined;

  return (
    <div style={{ padding: '20px', maxWidth: '720px' }}>
      <Link href={`/threads/${thread.id}`}>← 스레드로 돌아가기</Link>
      <h1>핸드오프: {thread.title}</h1>

      {error && <p role="alert">오류: {error}</p>}
      {notice && <p role="status">{notice}</p>}

      <section style={{ marginBottom: '24px' }}>
        <h3>맥락</h3>
        <p><strong>처음 의도:</strong> {thread.originalIntent}</p>
        <p><strong>오늘의 목표:</strong> {thread.todayGoal ?? '—'}</p>
        <p><strong>완료 조건:</strong> {thread.doneCondition ?? '—'}</p>
        <p><strong>현재 상태:</strong> {label(STATUS_LABEL, thread.status)}</p>
      </section>

      {!handoff || !fields ? (
        <section>
          <h3>아직 핸드오프가 없어요</h3>
          <p>스레드의 처음 의도, 최근 진행 기록, 가장 최근 세션을 바탕으로 초안을 만들어요.</p>
          <select
            aria-label="넘겨받을 AI 도구"
            value={newDraftProvider}
            onChange={(e) => setNewDraftProvider(e.target.value as ProviderType)}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABEL[provider]}
              </option>
            ))}
          </select>{' '}
          <button
            onClick={() =>
              runAction(
                '초안 생성',
                () =>
                  threadKeeperClient.generateHandoffDraft(thread.id, {
                    targetProvider: newDraftProvider,
                  }),
                '초안을 만들었어요.',
              )
            }
            disabled={busy !== null}
          >
            {busy === '초안 생성' ? '만드는 중...' : '초안 만들기'}
          </button>
        </section>
      ) : (
        <section>
          <h3>초안 ({label(HANDOFF_STATUS_LABEL, handoff.status)})</h3>
          <p>
            <strong>원본 세션:</strong>{' '}
            {sourceSession
              ? `${label(PROVIDER_LABEL, sourceSession.provider)} / ${sourceSession.title ?? sourceSession.providerSessionKey}`
              : '연결된 세션 없음'}
          </p>

          <label htmlFor="targetProvider">넘겨받을 AI 도구</label>
          <select
            id="targetProvider"
            value={fields.targetProvider}
            onChange={(e) => update({ targetProvider: e.target.value as ProviderType })}
            style={fieldStyle}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABEL[provider]}
              </option>
            ))}
          </select>

          <label htmlFor="reason">이유</label>
          <input
            id="reason"
            value={fields.reason}
            onChange={(e) => update({ reason: e.target.value })}
            maxLength={100}
            style={fieldStyle}
          />

          <label htmlFor="whatChanged">한 일</label>
          <textarea
            id="whatChanged"
            value={fields.whatChanged}
            onChange={(e) => update({ whatChanged: e.target.value })}
            rows={5}
            style={fieldStyle}
          />

          <label htmlFor="blockers">막힌 점</label>
          <textarea
            id="blockers"
            value={fields.blockers}
            onChange={(e) => update({ blockers: e.target.value })}
            rows={3}
            style={fieldStyle}
          />

          <label htmlFor="nextAction">다음 할 일</label>
          <textarea
            id="nextAction"
            value={fields.nextAction}
            onChange={(e) => update({ nextAction: e.target.value })}
            rows={3}
            style={fieldStyle}
          />

          <label htmlFor="filesNote">살펴볼 파일</label>
          <textarea
            id="filesNote"
            value={fields.filesNote}
            onChange={(e) => update({ filesNote: e.target.value })}
            rows={3}
            style={fieldStyle}
          />

          <button
            onClick={() =>
              runAction(
                '초안 저장',
                () => threadKeeperClient.updateHandoff(handoff.id, toPayload(fields)),
                '초안을 저장했어요.',
              )
            }
            disabled={busy !== null}
            style={{ marginRight: '10px', padding: '10px 20px' }}
          >
            {busy === '초안 저장' ? '저장 중...' : '초안 저장'}
          </button>
          <button
            onClick={() =>
              runAction(
                '핸드오프 확정',
                () =>
                  threadKeeperClient.updateHandoff(handoff.id, {
                    ...toPayload(fields),
                    status: 'READY',
                  }),
                '핸드오프를 준비 완료로 표시했어요.',
              )
            }
            disabled={busy !== null || handoff.status === 'READY'}
            style={{ padding: '10px 20px' }}
          >
            {busy === '핸드오프 확정' ? '확정 중...' : '핸드오프 확정'}
          </button>
        </section>
      )}
    </div>
  );
}
