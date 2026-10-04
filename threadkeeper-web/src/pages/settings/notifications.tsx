import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { NotificationChannel, NotificationRuleType } from '@/types/thread';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import { formatTimestamp } from '@/lib/format';
import { CHANNEL_LABEL, DELIVERY_LABEL, RULE_TYPE_LABEL, label } from '@/lib/labels';

const RULE_TYPES: NotificationRuleType[] = ['INACTIVITY', 'COMPLETION', 'DAILY_BRIEFING', 'DRIFT_ALERT'];
const CHANNELS: NotificationChannel[] = ['DISCORD', 'DESKTOP', 'EMAIL'];

/** What each rule type actually needs filled in, so the form only asks for that. */
const RULE_HELP: Record<NotificationRuleType, string> = {
  INACTIVITY: '스레드가 정한 시간(분) 동안 아무 활동이 없으면 알려요.',
  COMPLETION: '스레드가 완료로 표시되면 알려요.',
  DAILY_BRIEFING: '정한 시각에 아침 브리핑을 보내요.',
  DRIFT_ALERT: '스레드가 처음 의도에서 벗어나면 알려요.',
};

function usesThreshold(ruleType: NotificationRuleType) {
  return ruleType === 'INACTIVITY';
}

function usesSchedule(ruleType: NotificationRuleType) {
  return ruleType === 'DAILY_BRIEFING';
}

export default function NotificationSettings() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [ruleType, setRuleType] = useState<NotificationRuleType>('INACTIVITY');
  const [channel, setChannel] = useState<NotificationChannel>('DISCORD');
  const [thresholdMinutes, setThresholdMinutes] = useState('60');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  const resource = useAsyncResource(async () => {
    const [rules, events] = await Promise.all([
      threadKeeperClient.listNotificationRules(),
      threadKeeperClient.listNotificationEvents(),
    ]);
    return { rules, events };
  });

  const runAction = async (name: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      resource.reload();
      if (done) setNotice(typeof result === 'string' ? result : done);
    } catch (err) {
      setError(describeApiError(err, `${name}에 실패했어요`));
    } finally {
      setBusy(null);
    }
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    runAction(
      '규칙 추가',
      () =>
        threadKeeperClient.createNotificationRule({
          ruleType,
          enabled: true,
          channel,
          thresholdMinutes: usesThreshold(ruleType) ? Number(thresholdMinutes) : null,
          scheduledTime: usesSchedule(ruleType) ? scheduledTime : null,
          configJson: '{}',
        }),
      '규칙을 추가했어요.',
    );
  };

  if (resource.loading) return <div>알림 설정을 불러오는 중...</div>;
  if (!resource.data) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>알림 설정</h1>
        <LoadError
          error={resource.error ?? '알림 설정을 불러오지 못했어요'}
          code={resource.errorCode}
          failures={resource.failures}
          retrying={resource.retrying}
          onRetry={resource.reload}
        />
      </div>
    );
  }

  const { rules, events } = resource.data;

  return (
    <div style={{ padding: '20px', maxWidth: '760px' }}>
      <h1>알림 설정</h1>
      <p>어떤 일이 생겼을 때, 얼마나 자주, 어디로 알릴지 정해요.</p>

      {error && <p role="alert">오류: {error}</p>}
      {notice && <p role="status">{notice}</p>}

      <section style={{ marginBottom: '30px' }}>
        <h2>규칙 ({rules.length})</h2>
        {rules.length === 0 ? (
          <p>아직 규칙이 없어요. 규칙을 추가하기 전에는 알림이 가지 않아요.</p>
        ) : (
          <ul>
            {rules.map((rule) => (
              <li key={rule.id} style={{ marginBottom: '10px' }}>
                <strong>{label(RULE_TYPE_LABEL, rule.ruleType)}</strong> · {label(CHANNEL_LABEL, rule.channel)}{' '}
                —{' '}
                {rule.enabled ? '켜짐' : '꺼짐'}
                {rule.thresholdMinutes !== null && ` · ${rule.thresholdMinutes}분 후`}
                {rule.scheduledTime && ` · ${rule.scheduledTime}`}{' '}
                <button
                  onClick={() =>
                    runAction(
                      `규칙 ${rule.id} 켜기/끄기`,
                      // A partial update, so the toggle sends only what it changes
                      // rather than echoing back fields it never showed the user.
                      () =>
                        threadKeeperClient.updateNotificationRule(rule.id, {
                          enabled: !rule.enabled,
                        }),
                      rule.enabled ? '규칙을 껐어요.' : '규칙을 켰어요.',
                    )
                  }
                  disabled={busy !== null}
                >
                  {rule.enabled ? '끄기' : '켜기'}
                </button>{' '}
                <button
                  onClick={() =>
                    runAction(
                      `규칙 ${rule.id} 삭제`,
                      () => threadKeeperClient.deleteNotificationRule(rule.id),
                      '규칙을 삭제했어요.',
                    )
                  }
                  disabled={busy !== null}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>규칙 추가</h2>
        <form onSubmit={onCreate}>
          <label htmlFor="ruleType">알림 종류</label>{' '}
          <select
            id="ruleType"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as NotificationRuleType)}
          >
            {RULE_TYPES.map((type) => (
              <option key={type} value={type}>
                {RULE_TYPE_LABEL[type]}
              </option>
            ))}
          </select>{' '}
          <label htmlFor="channel">받을 곳</label>{' '}
          <select
            id="channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as NotificationChannel)}
          >
            {CHANNELS.map((value) => (
              <option key={value} value={value}>
                {CHANNEL_LABEL[value]}
              </option>
            ))}
          </select>{' '}
          {usesThreshold(ruleType) && (
            <>
              <label htmlFor="thresholdMinutes">멈춘 시간 (분)</label>{' '}
              <input
                id="thresholdMinutes"
                type="number"
                min={1}
                value={thresholdMinutes}
                onChange={(e) => setThresholdMinutes(e.target.value)}
                style={{ width: '80px' }}
              />{' '}
            </>
          )}
          {usesSchedule(ruleType) && (
            <>
              <label htmlFor="scheduledTime">브리핑 시각</label>{' '}
              <input
                id="scheduledTime"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />{' '}
            </>
          )}
          <button type="submit" disabled={busy !== null}>
            {busy === '규칙 추가' ? '추가 중...' : '규칙 추가'}
          </button>
          <p>{RULE_HELP[ruleType]}</p>
        </form>
      </section>

      <section>
        <h2>최근 알림 ({events.length})</h2>
        <p>
          알림 확인과 발송은 정해진 주기마다 자동으로 돌아요. 아래 버튼은 지금 바로 실행할 때만 써요.{' '}
          <button
            onClick={() =>
              runAction(
                '알림 확인',
                async () => {
                  const result = await threadKeeperClient.evaluateNotificationRules();
                  return `알림 ${result.queuedCount}개를 대기열에 넣었어요.`;
                },
                '확인했어요.',
              )
            }
            disabled={busy !== null}
          >
            지금 확인
          </button>{' '}
          <button
            onClick={() =>
              runAction(
                '알림 발송',
                async () => {
                  const result = await threadKeeperClient.dispatchNotifications();
                  return `알림 ${result.dispatchedCount}개를 보냈어요.`;
                },
                '보냈어요.',
              )
            }
            disabled={busy !== null}
          >
            지금 발송
          </button>
        </p>
        {events.length === 0 ? (
          <p>아직 대기 중이거나 보낸 알림이 없어요.</p>
        ) : (
          <ul>
            {events.slice(0, 15).map((event) => (
              <li key={event.id}>
                {label(RULE_TYPE_LABEL, event.eventType)} · {label(CHANNEL_LABEL, event.channel)} ·{' '}
                <strong>{label(DELIVERY_LABEL, event.deliveryStatus)}</strong> ·{' '}
                {formatTimestamp(event.createdAt)}
                {event.threadId !== null && (
                  <>
                    {' '}
                    <Link href={`/threads/${event.threadId}`}>스레드 {event.threadId}</Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
