import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { HandoffResponse, ProviderType, ThreadDetailResponse } from '@/types/thread';

const PROVIDERS: ProviderType[] = ['CLAUDE', 'CODEX', 'GEMINI', 'GPT'];

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
  const [thread, setThread] = useState<ThreadDetailResponse | null>(null);
  const [handoff, setHandoff] = useState<HandoffResponse | null>(null);
  const [fields, setFields] = useState<DraftFields | null>(null);
  const [newDraftProvider, setNewDraftProvider] = useState<ProviderType>('CLAUDE');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await threadKeeperClient.getThread(Number(threadId));
    setThread(data);
    const latest = data.handoffs.length > 0 ? data.handoffs[0] : null;
    setHandoff(latest);
    setFields(latest ? toFields(latest) : null);
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;

    const run = async () => {
      try {
        await load();
      } catch (err) {
        setError(describeApiError(err, 'Failed to load the handoff'));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [threadId, load]);

  const runAction = async (name: string, action: () => Promise<unknown>, done: string) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load();
      setNotice(done);
    } catch (err) {
      setError(describeApiError(err, `Failed to ${name}`));
    } finally {
      setBusy(null);
    }
  };

  const update = (patch: Partial<DraftFields>) =>
    setFields((current) => (current ? { ...current, ...patch } : current));

  if (loading) return <div>Loading...</div>;
  if (error && !thread) return <div>Error: {error}</div>;
  if (!thread) return <div>Thread not found</div>;

  const sourceSession = handoff?.sourceSessionId
    ? thread.sourceSessions.find((session) => session.id === handoff.sourceSessionId)
    : undefined;

  return (
    <div style={{ padding: '20px', maxWidth: '720px' }}>
      <Link href={`/threads/${thread.id}`}>← Back to Thread</Link>
      <h1>Handoff: {thread.title}</h1>

      {error && <p role="alert">Error: {error}</p>}
      {notice && <p role="status">{notice}</p>}

      <section style={{ marginBottom: '24px' }}>
        <h3>Context</h3>
        <p><strong>Original Intent:</strong> {thread.originalIntent}</p>
        <p><strong>Today&apos;s Goal:</strong> {thread.todayGoal ?? '—'}</p>
        <p><strong>Done Condition:</strong> {thread.doneCondition ?? '—'}</p>
        <p><strong>Current Status:</strong> {thread.status}</p>
      </section>

      {!handoff || !fields ? (
        <section>
          <h3>No handoff yet</h3>
          <p>Generate a draft from the thread&apos;s intent, latest snapshot, and most recent session.</p>
          <select
            aria-label="Target provider"
            value={newDraftProvider}
            onChange={(e) => setNewDraftProvider(e.target.value as ProviderType)}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>{' '}
          <button
            onClick={() =>
              runAction(
                'generate the draft',
                () =>
                  threadKeeperClient.generateHandoffDraft(thread.id, {
                    targetProvider: newDraftProvider,
                  }),
                'Draft generated.',
              )
            }
            disabled={busy !== null}
          >
            {busy === 'generate the draft' ? 'Generating...' : 'Generate Draft'}
          </button>
        </section>
      ) : (
        <section>
          <h3>Draft ({handoff.status})</h3>
          <p>
            <strong>Source session:</strong>{' '}
            {sourceSession
              ? `${sourceSession.provider} / ${sourceSession.title ?? sourceSession.providerSessionKey}`
              : 'none linked'}
          </p>

          <label htmlFor="targetProvider">Target provider</label>
          <select
            id="targetProvider"
            value={fields.targetProvider}
            onChange={(e) => update({ targetProvider: e.target.value as ProviderType })}
            style={fieldStyle}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>

          <label htmlFor="reason">Reason</label>
          <input
            id="reason"
            value={fields.reason}
            onChange={(e) => update({ reason: e.target.value })}
            maxLength={100}
            style={fieldStyle}
          />

          <label htmlFor="whatChanged">What was done</label>
          <textarea
            id="whatChanged"
            value={fields.whatChanged}
            onChange={(e) => update({ whatChanged: e.target.value })}
            rows={5}
            style={fieldStyle}
          />

          <label htmlFor="blockers">What is blocked</label>
          <textarea
            id="blockers"
            value={fields.blockers}
            onChange={(e) => update({ blockers: e.target.value })}
            rows={3}
            style={fieldStyle}
          />

          <label htmlFor="nextAction">Next action</label>
          <textarea
            id="nextAction"
            value={fields.nextAction}
            onChange={(e) => update({ nextAction: e.target.value })}
            rows={3}
            style={fieldStyle}
          />

          <label htmlFor="filesNote">Files to look at</label>
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
                'save the draft',
                () => threadKeeperClient.updateHandoff(handoff.id, toPayload(fields)),
                'Draft saved.',
              )
            }
            disabled={busy !== null}
            style={{ marginRight: '10px', padding: '10px 20px' }}
          >
            {busy === 'save the draft' ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() =>
              runAction(
                'finalize the handoff',
                () =>
                  threadKeeperClient.updateHandoff(handoff.id, {
                    ...toPayload(fields),
                    status: 'READY',
                  }),
                'Handoff marked ready.',
              )
            }
            disabled={busy !== null || handoff.status === 'READY'}
            style={{ padding: '10px 20px' }}
          >
            {busy === 'finalize the handoff' ? 'Finalizing...' : 'Finalize Handoff'}
          </button>
        </section>
      )}
    </div>
  );
}
