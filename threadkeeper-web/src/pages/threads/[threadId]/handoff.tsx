import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { HandoffResponse, ProviderType } from '@/types/thread';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { formatTimestamp } from '@/lib/format';

const PROVIDERS: ProviderType[] = ['CLAUDE', 'CODEX', 'GEMINI', 'GPT'];

interface ComposerFields {
  targetProvider: ProviderType;
  reason: string;
  whatChanged: string;
  blockers: string;
  nextAction: string;
  filesNote: string;
}

const EMPTY_FIELDS: ComposerFields = {
  targetProvider: 'CLAUDE',
  reason: '',
  whatChanged: '',
  blockers: '',
  nextAction: '',
  filesNote: '',
};

function toFields(handoff: HandoffResponse): ComposerFields {
  return {
    targetProvider: handoff.targetProvider,
    reason: handoff.reason ?? '',
    whatChanged: handoff.whatChanged ?? '',
    blockers: handoff.blockers ?? '',
    nextAction: handoff.nextAction ?? '',
    filesNote: handoff.filesNote ?? '',
  };
}

// The API rejects blank strings on optional fields less predictably than nulls.
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export default function HandoffComposer() {
  const router = useRouter();
  const { threadId } = router.query;
  // router.query is empty on the very first render of a dynamic route.
  const ready = typeof threadId === 'string';

  const {
    data: thread,
    error: loadError,
    loading,
    failures,
    retrying,
    reload,
  } = useAsyncResource(
    () => threadKeeperClient.getThread(Number(threadId)),
    [threadId],
    ready,
  );

  const [handoffs, setHandoffs] = useState<HandoffResponse[]>([]);
  const [fields, setFields] = useState<ComposerFields>(EMPTY_FIELDS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Seed the composer once the thread arrives, and again after a manual reload.
  useEffect(() => {
    if (!thread) return;
    setHandoffs(thread.handoffs);
    if (thread.handoffs.length > 0) {
      setFields(toFields(thread.handoffs[0]));
    } else {
      setFields((current) => ({ ...current, nextAction: thread.currentNextAction ?? '' }));
    }
  }, [thread]);

  const refresh = async (id: number) => {
    setHandoffs(await threadKeeperClient.listHandoffs(id));
  };

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: '20px' }}>
        <Link href="/">← Back</Link>
        <LoadError error={loadError} failures={failures} retrying={retrying} onRetry={reload} />
      </div>
    );
  }

  if (loading || !thread) return <div style={{ padding: '20px' }}>Loading...</div>;

  const threadIdNumber = thread.id;

  const handleGenerate = () =>
    runAction(async () => {
      const draft = await threadKeeperClient.generateHandoffDraft(threadIdNumber, {
        targetProvider: fields.targetProvider,
        reasonHint: orNull(fields.reason),
      });
      setFields(toFields(draft));
      await refresh(threadIdNumber);
    }, '초안을 생성했습니다.');

  const handleSave = () =>
    runAction(async () => {
      await threadKeeperClient.createHandoff(threadIdNumber, {
        targetProvider: fields.targetProvider,
        reason: orNull(fields.reason),
        whatChanged: orNull(fields.whatChanged),
        blockers: orNull(fields.blockers),
        nextAction: orNull(fields.nextAction),
        filesNote: orNull(fields.filesNote),
        status: 'DRAFT',
      });
      await refresh(threadIdNumber);
    }, '초안을 저장했습니다.');

  const handleFinalize = (handoffId: number) =>
    runAction(async () => {
      await threadKeeperClient.updateHandoffStatus(handoffId, 'READY');
      await refresh(threadIdNumber);
    }, '핸드오프를 READY로 변경했습니다.');

  const field = (label: string, key: keyof ComposerFields, rows = 3) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>{label}</label>
      <textarea
        value={fields[key]}
        onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
        rows={rows}
        style={{ width: '100%' }}
      />
    </div>
  );

  return (
    <div style={{ padding: '20px' }}>
      <Link href={`/threads/${thread.id}`}>← Back to Thread</Link>
      <h1>Handoff Composer: {thread.title}</h1>

      <section style={{ marginBottom: '20px' }}>
        <h3>Context</h3>
        <p><strong>Original Intent:</strong> {thread.originalIntent}</p>
        <p><strong>Today&apos;s Goal:</strong> {thread.todayGoal || '-'}</p>
        <p><strong>Done Condition:</strong> {thread.doneCondition || '-'}</p>
        <p><strong>Current Status:</strong> {thread.status}</p>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h3>Compose</h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
            Target Provider
          </label>
          <select
            value={fields.targetProvider}
            onChange={(e) =>
              setFields({ ...fields, targetProvider: e.target.value as ProviderType })
            }
          >
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>
        {field('Reason', 'reason', 2)}
        {field('What Changed', 'whatChanged')}
        {field('Blockers', 'blockers')}
        {field('Next Action', 'nextAction', 2)}
        {field('Files To Look At', 'filesNote', 2)}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleGenerate} disabled={busy} style={{ padding: '10px 20px' }}>
            서버에서 초안 생성
          </button>
          <button onClick={handleSave} disabled={busy} style={{ padding: '10px 20px' }}>
            초안 저장
          </button>
        </div>
        {message && <p style={{ color: '#047857', marginTop: '10px' }}>{message}</p>}
        {actionError && <p style={{ color: '#b91c1c', marginTop: '10px' }}>{actionError}</p>}
      </section>

      <section>
        <h3>Handoff History ({handoffs.length})</h3>
        {handoffs.length === 0 ? (
          <p style={{ color: '#888' }}>아직 핸드오프가 없습니다.</p>
        ) : (
          <ul>
            {handoffs.map((handoff) => (
              <li key={handoff.id}>
                <div>
                  <strong>{handoff.targetProvider}</strong> · {handoff.status} ·{' '}
                  {formatTimestamp(handoff.createdAt)}
                </div>
                <div style={{ marginTop: '4px' }}>{handoff.whatChanged || '-'}</div>
                <div style={{ marginTop: '4px', display: 'flex', gap: '10px' }}>
                  <button onClick={() => setFields(toFields(handoff))} disabled={busy}>
                    편집기로 불러오기
                  </button>
                  {handoff.status === 'DRAFT' && (
                    <button onClick={() => handleFinalize(handoff.id)} disabled={busy}>
                      READY로 표시
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
