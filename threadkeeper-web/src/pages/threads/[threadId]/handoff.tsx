import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { threadKeeperClient } from '@/api/client';
import { ThreadDetailResponse } from '@/types/thread';

export default function HandoffDraft() {
  const router = useRouter();
  const { threadId } = router.query;
  const [thread, setThread] = useState<ThreadDetailResponse | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!threadId) return;

    const loadThread = async () => {
      try {
        const data = await threadKeeperClient.getThread(Number(threadId));
        setThread(data);
        if (data.handoffs.length > 0) {
          setDraftContent(data.handoffs[0].draftContent);
        }
      } finally {
        setLoading(false);
      }
    };

    loadThread();
  }, [threadId]);

  if (loading) return <div>Loading...</div>;
  if (!thread) return <div>Thread not found</div>;

  return (
    <div style={{ padding: '20px' }}>
      <Link href={`/threads/${thread.id}`}>
        <a>← Back to Thread</a>
      </Link>
      <h1>Handoff Draft: {thread.title}</h1>

      <div style={{ marginBottom: '20px' }}>
        <h3>Context</h3>
        <p><strong>Original Intent:</strong> {thread.originalIntent}</p>
        <p><strong>Today's Goal:</strong> {thread.todayGoal}</p>
        <p><strong>Done Condition:</strong> {thread.doneCondition}</p>
        <p><strong>Current Status:</strong> {thread.status}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Draft Content</h3>
        <textarea
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          style={{
            width: '100%',
            height: '300px',
            padding: '10px',
            fontFamily: 'monospace',
          }}
          placeholder="Enter handoff draft content here..."
        />
      </div>

      <div>
        <button style={{ marginRight: '10px', padding: '10px 20px' }}>Save Draft</button>
        <button style={{ padding: '10px 20px' }}>Finalize Handoff</button>
      </div>
    </div>
  );
}
