import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { ThreadPriority } from '@/types/thread';
import { PRIORITY_LABEL } from '@/lib/labels';

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
      setError(describeApiError(err, '스레드를 만들지 못했어요'));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '640px' }}>
      <h1>새 스레드</h1>
      <p>
        처음 의도는 한 번 저장되면 가져오기로 덮어쓰지 않아요. 이 스레드를 왜 시작했는지 잊었을 때
        돌아와서 보는 기준이에요.
      </p>

      {error && <p role="alert">오류: {error}</p>}

      <form onSubmit={onSubmit}>
        <label htmlFor="projectKey">프로젝트</label>
        <input
          id="projectKey"
          value={projectKey}
          onChange={(e) => setProjectKey(e.target.value)}
          maxLength={100}
          required
          style={fieldStyle}
          placeholder="threadkeeper"
        />

        <label htmlFor="title">제목</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
          style={fieldStyle}
          placeholder="결제 웹훅 재시도 로직 구현"
        />

        <label htmlFor="priority">우선순위</label>
        <select
          id="priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as ThreadPriority)}
          style={fieldStyle}
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABEL[value]}
            </option>
          ))}
        </select>

        <label htmlFor="originalIntent">처음 의도</label>
        <textarea
          id="originalIntent"
          value={originalIntent}
          onChange={(e) => setOriginalIntent(e.target.value)}
          required
          rows={4}
          style={fieldStyle}
          placeholder="실제로 이루고 싶은 게 무엇인가요?"
        />

        <label htmlFor="todayGoal">오늘의 목표</label>
        <textarea
          id="todayGoal"
          value={todayGoal}
          onChange={(e) => setTodayGoal(e.target.value)}
          maxLength={2000}
          rows={2}
          style={fieldStyle}
        />

        <label htmlFor="doneCondition">완료 조건</label>
        <textarea
          id="doneCondition"
          value={doneCondition}
          onChange={(e) => setDoneCondition(e.target.value)}
          maxLength={2000}
          rows={2}
          style={fieldStyle}
          placeholder="무엇이 되면 끝났다고 볼 수 있나요?"
        />

        <button type="submit" disabled={submitting} style={{ padding: '10px 20px', marginTop: '10px' }}>
          {submitting ? '만드는 중...' : '스레드 만들기'}
        </button>
      </form>
    </div>
  );
}
