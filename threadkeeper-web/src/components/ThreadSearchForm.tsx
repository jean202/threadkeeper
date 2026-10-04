import { FormEvent, useState } from 'react';
import { ProviderType, ThreadPriority, ThreadSearchParams, ThreadStatus } from '@/types/thread';
import { PRIORITY_LABEL, PROVIDER_LABEL, STATUS_LABEL } from '@/lib/labels';

const PROVIDERS: ProviderType[] = ['CLAUDE', 'CODEX', 'GEMINI', 'GROK'];
const STATUSES: ThreadStatus[] = ['ACTIVE', 'PAUSED', 'BLOCKED', 'COMPLETED'];
const PRIORITIES: ThreadPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

/** Recency choices, in days. Anything longer is better served by leaving it off. */
const RECENCY: { label: string; days: number }[] = [
  { label: '최근 24시간', days: 1 },
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
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

  /**
   * The dropdowns apply as soon as they change: picking a value is already a
   * complete choice, unlike a half-typed keyword. The search carries the whole
   * form, so text already typed into the other fields applies along with it.
   */
  const updateAndSearch = (patch: Partial<FormState>) => {
    const next = { ...form, ...patch };
    setForm(next);
    onSearch(toParams(next));
  };

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
        <label htmlFor="q">키워드</label>{' '}
        <input
          id="q"
          value={form.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="제목, 의도, 다음 할 일..."
          style={{ ...controlStyle, width: '260px' }}
        />
        <label htmlFor="projectKey">프로젝트</label>{' '}
        <input
          id="projectKey"
          value={form.projectKey}
          onChange={(e) => update({ projectKey: e.target.value })}
          placeholder="threadkeeper"
          style={controlStyle}
        />
      </div>
      <div>
        <label htmlFor="provider">AI 도구</label>{' '}
        <select
          id="provider"
          value={form.provider}
          onChange={(e) => updateAndSearch({ provider: e.target.value })}
          style={controlStyle}
        >
          <option value="">전체</option>
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABEL[provider]}
            </option>
          ))}
        </select>
        <label htmlFor="status">상태</label>{' '}
        <select
          id="status"
          value={form.status}
          onChange={(e) => updateAndSearch({ status: e.target.value })}
          style={controlStyle}
        >
          <option value="">전체</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <label htmlFor="priority">우선순위</label>{' '}
        <select
          id="priority"
          value={form.priority}
          onChange={(e) => updateAndSearch({ priority: e.target.value })}
          style={controlStyle}
        >
          <option value="">전체</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABEL[priority]}
            </option>
          ))}
        </select>
        <label htmlFor="activeWithinDays">최근 활동</label>{' '}
        <select
          id="activeWithinDays"
          value={form.activeWithinDays}
          onChange={(e) => updateAndSearch({ activeWithinDays: e.target.value })}
          style={controlStyle}
        >
          <option value="">전체 기간</option>
          {RECENCY.map((option) => (
            <option key={option.days} value={String(option.days)}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy} style={controlStyle}>
          {busy ? '검색 중...' : '검색'}
        </button>
        {/* Never disabled: it is the way out of a search that is not coming back. */}
        <button type="button" onClick={onReset}>
          초기화
        </button>
      </div>
    </form>
  );
}
