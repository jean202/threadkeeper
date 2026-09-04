import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { ThreadPriority } from '@/types/thread';

const PRIORITIES: ThreadPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

const fieldStyle = { width: '100%', padding: '8px', marginBottom: '4px' } as const;

export default function NewThread() {
  const router = useRouter();
  const [projectKey, setProjectKey] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<ThreadPriority>('MEDIUM');
  const [originalIntent, setOriginalIntent] = useState('');
  const [todayGoal, setTodayGoal] = useState('');
  const [doneCondition, setDoneCondition] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await threadKeeperClient.createThread({
        projectKey,
        title,
        priority,
        originalIntent,
        todayGoal,
        doneCondition,
      });
      // Straight to the thread you just described -- that is where the next
      // action lives.
      await router.push(`/threads/${created.id}`);
    } catch (err) {
      setError(describeApiError(err, 'Failed to create the thread'));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '640px' }}>
      <h1>New Thread</h1>
      <p>
        The original intent is stored once and never rewritten by imports -- it is what you come back
        to when you have forgotten why this thread exists.
      </p>

      {error && <p role="alert">Error: {error}</p>}

      <form onSubmit={onSubmit}>
        <label htmlFor="projectKey">Project key</label>
        <input
          id="projectKey"
          value={projectKey}
          onChange={(e) => setProjectKey(e.target.value)}
          maxLength={100}
          required
          style={fieldStyle}
          placeholder="threadkeeper"
        />

        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
          style={fieldStyle}
          placeholder="Implement billing webhook retry logic"
        />

        <label htmlFor="priority">Priority</label>
        <select
          id="priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as ThreadPriority)}
          style={fieldStyle}
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <label htmlFor="originalIntent">Original intent</label>
        <textarea
          id="originalIntent"
          value={originalIntent}
          onChange={(e) => setOriginalIntent(e.target.value)}
          required
          rows={4}
          style={fieldStyle}
          placeholder="What are you actually trying to accomplish?"
        />

        <label htmlFor="todayGoal">Today&apos;s goal</label>
        <textarea
          id="todayGoal"
          value={todayGoal}
          onChange={(e) => setTodayGoal(e.target.value)}
          maxLength={2000}
          rows={2}
          style={fieldStyle}
        />

        <label htmlFor="doneCondition">Done condition</label>
        <textarea
          id="doneCondition"
          value={doneCondition}
          onChange={(e) => setDoneCondition(e.target.value)}
          maxLength={2000}
          rows={2}
          style={fieldStyle}
          placeholder="How will you know this is finished?"
        />

        <button type="submit" disabled={submitting} style={{ padding: '10px 20px', marginTop: '10px' }}>
          {submitting ? 'Creating...' : 'Create Thread'}
        </button>
      </form>
    </div>
  );
}
