import { useEffect, useState } from 'react';
import { threadKeeperClient } from '@/api/client';
import NavBar from '@/components/NavBar';
import LoadError from '@/components/LoadError';
import { useAsyncResource } from '@/lib/useAsyncResource';
import {
  CreateNotificationRuleRequest,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationRuleResponse,
  NotificationRuleType,
} from '@/types/notification';
import { formatTimestamp } from '@/lib/format';

const RULE_TYPES: NotificationRuleType[] = [
  'INACTIVITY',
  'COMPLETION',
  'DAILY_BRIEFING',
  'DRIFT_ALERT',
];
const CHANNELS: NotificationChannel[] = ['DESKTOP', 'DISCORD', 'EMAIL'];
const DELIVERY_STATUSES: NotificationDeliveryStatus[] = ['QUEUED', 'SENT', 'FAILED'];

const RULE_TYPE_HINTS: Record<NotificationRuleType, string> = {
  INACTIVITY: '스레드가 임계 시간 동안 조용하면 알립니다.',
  COMPLETION: '스레드가 COMPLETED로 바뀔 때 알립니다.',
  DAILY_BRIEFING: '지정한 시각(HH:mm, Asia/Seoul)에 오늘 이어갈 스레드를 보냅니다.',
  DRIFT_ALERT: '스레드가 원래 목표에서 벗어나면 알립니다.',
};

/** Only these rule types read thresholdMinutes; the others ignore it. */
function usesThreshold(ruleType: NotificationRuleType): boolean {
  return ruleType === 'INACTIVITY' || ruleType === 'DRIFT_ALERT';
}

function usesSchedule(ruleType: NotificationRuleType): boolean {
  return ruleType === 'DAILY_BRIEFING';
}

const EMPTY_NEW_RULE: CreateNotificationRuleRequest = {
  ruleType: 'INACTIVITY',
  enabled: true,
  channel: 'DISCORD',
  thresholdMinutes: 90,
  scheduledTime: null,
  configJson: '{}',
};

function RuleRow({
  rule,
  busy,
  onChange,
}: {
  rule: NotificationRuleResponse;
  busy: boolean;
  onChange: (ruleId: number, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [threshold, setThreshold] = useState(
    rule.thresholdMinutes === null ? '' : String(rule.thresholdMinutes),
  );
  const [scheduledTime, setScheduledTime] = useState(rule.scheduledTime ?? '');
  const [configJson, setConfigJson] = useState(rule.configJson);

  // A refetch after any save replaces the rule object, so re-sync the inputs.
  useEffect(() => {
    setThreshold(rule.thresholdMinutes === null ? '' : String(rule.thresholdMinutes));
    setScheduledTime(rule.scheduledTime ?? '');
    setConfigJson(rule.configJson);
  }, [rule]);

  const saveDetails = () => {
    const patch: Record<string, unknown> = { configJson };
    if (usesThreshold(rule.ruleType) && threshold.trim() !== '') {
      patch.thresholdMinutes = Number(threshold);
    }
    if (usesSchedule(rule.ruleType) && scheduledTime.trim() !== '') {
      patch.scheduledTime = scheduledTime.trim();
    }
    return onChange(rule.id, patch);
  };

  return (
    <li>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            checked={rule.enabled}
            disabled={busy}
            onChange={(e) => onChange(rule.id, { enabled: e.target.checked })}
          />
          <strong>{rule.ruleType}</strong>
        </label>
        <select
          value={rule.channel}
          disabled={busy}
          onChange={(e) => onChange(rule.id, { channel: e.target.value })}
        >
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
        <span style={{ color: '#888', fontSize: '12px' }}>#{rule.id}</span>
      </div>

      <p style={{ color: '#666', fontSize: '13px', margin: '6px 0' }}>
        {RULE_TYPE_HINTS[rule.ruleType]}
      </p>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {usesThreshold(rule.ruleType) && (
          <label style={{ fontSize: '13px' }}>
            <div>임계 시간(분)</div>
            <input
              type="number"
              min={1}
              value={threshold}
              disabled={busy}
              onChange={(e) => setThreshold(e.target.value)}
              style={{ width: '110px' }}
            />
          </label>
        )}
        {usesSchedule(rule.ruleType) && (
          <label style={{ fontSize: '13px' }}>
            <div>발송 시각 (HH:mm)</div>
            <input
              type="text"
              placeholder="08:30"
              value={scheduledTime}
              disabled={busy}
              onChange={(e) => setScheduledTime(e.target.value)}
              style={{ width: '110px' }}
            />
          </label>
        )}
        <label style={{ fontSize: '13px', flex: 1, minWidth: '240px' }}>
          <div>configJson</div>
          <input
            type="text"
            value={configJson}
            disabled={busy}
            onChange={(e) => setConfigJson(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>
        <button onClick={saveDetails} disabled={busy}>
          저장
        </button>
      </div>
    </li>
  );
}

export default function Notifications() {
  const [statusFilter, setStatusFilter] = useState<NotificationDeliveryStatus | 'ALL'>('ALL');
  const [newRule, setNewRule] = useState<CreateNotificationRuleRequest>(EMPTY_NEW_RULE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error: loadError, loading, failures, retrying, reload } = useAsyncResource(
    async () => {
      const [rules, events] = await Promise.all([
        threadKeeperClient.listNotificationRules(),
        threadKeeperClient.listNotificationEvents(),
      ]);
      return { rules, events };
    },
  );

  const rules = data?.rules ?? [];
  const events = data?.events ?? [];

  const runAction = async (action: () => Promise<string>) => {
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      setMessage(await action());
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRuleChange = (ruleId: number, patch: Record<string, unknown>) =>
    runAction(async () => {
      await threadKeeperClient.updateNotificationRule(ruleId, patch);
      return `규칙 #${ruleId}을 저장했습니다.`;
    });

  const handleCreate = () =>
    runAction(async () => {
      await threadKeeperClient.createNotificationRule({
        ...newRule,
        thresholdMinutes: usesThreshold(newRule.ruleType) ? newRule.thresholdMinutes : null,
        scheduledTime: usesSchedule(newRule.ruleType) ? newRule.scheduledTime : null,
        configJson: newRule.configJson.trim() === '' ? '{}' : newRule.configJson,
      });
      setNewRule(EMPTY_NEW_RULE);
      return '규칙을 추가했습니다.';
    });

  const handleEvaluate = () =>
    runAction(async () => {
      const result = await threadKeeperClient.evaluateNotificationRules();
      return `${result.queuedCount}건을 큐에 넣었습니다.`;
    });

  const handleDispatch = () =>
    runAction(async () => {
      const result = await threadKeeperClient.dispatchNotifications();
      return `${result.dispatchedCount}건을 발송했습니다.`;
    });

  const visibleEvents =
    statusFilter === 'ALL'
      ? events
      : events.filter((event) => event.deliveryStatus === statusFilter);

  return (
    <div style={{ padding: '20px' }}>
      <NavBar current="/notifications" />
      <h1>알림 · 규칙</h1>

      {message && <p style={{ color: '#047857' }}>{message}</p>}
      {actionError && <p style={{ color: '#b91c1c' }}>{actionError}</p>}
      {loadError && (
        <LoadError error={loadError} failures={failures} retrying={retrying} onRetry={reload} />
      )}
      {loading && <p>Loading...</p>}

      <section style={{ marginBottom: '20px' }}>
        <h2>규칙 ({rules.length})</h2>
        {rules.length === 0 ? (
          <p style={{ color: '#888' }}>등록된 규칙이 없습니다.</p>
        ) : (
          <ul>
            {rules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} busy={busy} onChange={handleRuleChange} />
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h2>규칙 추가</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px' }}>
            <div>종류</div>
            <select
              value={newRule.ruleType}
              onChange={(e) =>
                setNewRule({ ...newRule, ruleType: e.target.value as NotificationRuleType })
              }
            >
              {RULE_TYPES.map((ruleType) => (
                <option key={ruleType} value={ruleType}>
                  {ruleType}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '13px' }}>
            <div>채널</div>
            <select
              value={newRule.channel}
              onChange={(e) =>
                setNewRule({ ...newRule, channel: e.target.value as NotificationChannel })
              }
            >
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>
          {usesThreshold(newRule.ruleType) && (
            <label style={{ fontSize: '13px' }}>
              <div>임계 시간(분)</div>
              <input
                type="number"
                min={1}
                value={newRule.thresholdMinutes ?? ''}
                onChange={(e) =>
                  setNewRule({
                    ...newRule,
                    thresholdMinutes: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                style={{ width: '110px' }}
              />
            </label>
          )}
          {usesSchedule(newRule.ruleType) && (
            <label style={{ fontSize: '13px' }}>
              <div>발송 시각 (HH:mm)</div>
              <input
                type="text"
                placeholder="08:30"
                value={newRule.scheduledTime ?? ''}
                onChange={(e) =>
                  setNewRule({ ...newRule, scheduledTime: e.target.value || null })
                }
                style={{ width: '110px' }}
              />
            </label>
          )}
          <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              checked={newRule.enabled}
              onChange={(e) => setNewRule({ ...newRule, enabled: e.target.checked })}
            />
            바로 활성화
          </label>
          <button onClick={handleCreate} disabled={busy}>
            추가
          </button>
        </div>
        <p style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>
          {RULE_TYPE_HINTS[newRule.ruleType]}
        </p>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h2>수동 실행</h2>
        <p style={{ color: '#666', fontSize: '13px' }}>
          스케줄러가 백그라운드에서 자동으로 돌지만, 즉시 확인할 때 사용합니다.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleEvaluate} disabled={busy}>
            규칙 평가
          </button>
          <button onClick={handleDispatch} disabled={busy}>
            큐 발송
          </button>
        </div>
      </section>

      <section>
        <h2>발송 이력 ({visibleEvents.length})</h2>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '13px' }}>
            상태 필터{' '}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as NotificationDeliveryStatus | 'ALL')
              }
            >
              <option value="ALL">전체</option>
              {DELIVERY_STATUSES.map((deliveryStatus) => (
                <option key={deliveryStatus} value={deliveryStatus}>
                  {deliveryStatus}
                </option>
              ))}
            </select>
          </label>
        </div>
        {visibleEvents.length === 0 ? (
          <p style={{ color: '#888' }}>표시할 이력이 없습니다.</p>
        ) : (
          <ul>
            {visibleEvents.slice(0, 50).map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{event.eventType}</strong> · {event.channel} · {event.deliveryStatus}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                  생성 {formatTimestamp(event.createdAt)} · 발송 {formatTimestamp(event.sentAt)}
                  {event.threadId !== null && ` · thread #${event.threadId}`}
                </div>
                <div style={{ fontSize: '13px', marginTop: '4px', wordBreak: 'break-all' }}>
                  {event.payloadJson}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
