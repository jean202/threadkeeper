import { FormEvent, useState } from 'react';
import { ProviderType, ThreadPriority, ThreadSearchParams, ThreadStatus } from '@/types/thread';

const PROVIDERS: ProviderType[] = ['CLAUDE', 'CODEX', 'GEMINI', 'GPT'];
const STATUSES: ThreadStatus[] = ['ACTIVE', 'PAUSED', 'BLOCKED', 'COMPLETED'];
const PRIORITIES: ThreadPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

/** Recency choices, in days. Anything longer is better served by leaving it off. */
const RECENCY: { label: string; days: number }[] = [
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
];

/** What the form holds while it is being filled in: every control is a string. */
interface FormState {
  q: string;
  projectKey: string;
  provider: string;
  status: string;
  priority: string;
  activeWithinDays: string;
}

const EMPTY: FormState = {
  q: '',
  projectKey: '',
  provider: '',
  status: '',
  priority: '',
  activeWithinDays: '',
};

/** Drops the untouched fields, so a blank control never narrows the search. */
function toParams(form: FormState): ThreadSearchParams {
  return {
    q: form.q.trim() || undefined,
    projectKey: form.projectKey.trim() || undefined,
    provider: (form.provider as ProviderType) || undefined,
    status: (form.status as ThreadStatus) || undefined,
    priority: (form.priority as ThreadPriority) || undefined,
    activeWithinDays: form.activeWithinDays ? Number(form.activeWithinDays) : undefined,
  };
}

const controlStyle = { marginRight: '10px' } as const;

export default function ThreadSearchForm({
  onSearch,
  busy,
}: {
  onSearch: (params: ThreadSearchParams) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(toParams(form));
  };

  const onReset = () => {
    setForm(EMPTY);
    onSearch({});
  };

  return (
    <form onSubmit={onSubmit} style={{ marginBottom: '20px' }}>
      <div style={{ marginBottom: '8px' }}>
        <label htmlFor="q">Keyword</label>{' '}
        <input
          id="q"
          value={form.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="title, intent, next action..."
          style={{ ...controlStyle, width: '260px' }}
        />
        <label htmlFor="projectKey">Project</label>{' '}
        <input
          id="projectKey"
          value={form.projectKey}
          onChange={(e) => update({ projectKey: e.target.value })}
          placeholder="threadkeeper"
          style={controlStyle}
        />
      </div>
      <div>
        <label htmlFor="provider">Provider</label>{' '}
        <select
          id="provider"
          value={form.provider}
          onChange={(e) => update({ provider: e.target.value })}
          style={controlStyle}
        >
          <option value="">Any</option>
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
        <label htmlFor="status">Status</label>{' '}
        <select
          id="status"
          value={form.status}
          onChange={(e) => update({ status: e.target.value })}
          style={controlStyle}
        >
          <option value="">Any</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <label htmlFor="priority">Priority</label>{' '}
        <select
          id="priority"
          value={form.priority}
          onChange={(e) => update({ priority: e.target.value })}
          style={controlStyle}
        >
          <option value="">Any</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        <label htmlFor="activeWithinDays">Active within</label>{' '}
        <select
          id="activeWithinDays"
          value={form.activeWithinDays}
          onChange={(e) => update({ activeWithinDays: e.target.value })}
          style={controlStyle}
        >
          <option value="">Any time</option>
          {RECENCY.map((option) => (
            <option key={option.days} value={String(option.days)}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy} style={controlStyle}>
          {busy ? 'Searching...' : 'Search'}
        </button>
        <button type="button" onClick={onReset} disabled={busy}>
          Clear
        </button>
      </div>
    </form>
  );
}
