import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { describeApiError, threadKeeperClient } from '@/api/client';
import { NotificationChannel, NotificationEventResponse, NotificationRuleType } from '@/types/thread';
import { NotificationRuleResponse } from '@/types/settings';

const RULE_TYPES: NotificationRuleType[] = ['INACTIVITY', 'COMPLETION', 'DAILY_BRIEFING', 'DRIFT_ALERT'];
const CHANNELS: NotificationChannel[] = ['DISCORD', 'DESKTOP', 'EMAIL'];

/** What each rule type actually needs filled in, so the form only asks for that. */
const RULE_HELP: Record<NotificationRuleType, string> = {
  INACTIVITY: 'Alerts when a thread has had no activity for the threshold, in minutes.',
  COMPLETION: 'Sends a notice when a thread is marked completed.',
  DAILY_BRIEFING: 'Sends the morning briefing at the scheduled time (HH:mm).',
  DRIFT_ALERT: 'Alerts when a thread drifts away from its original intent.',
};

function usesThreshold(ruleType: NotificationRuleType) {
  return ruleType === 'INACTIVITY';
}

function usesSchedule(ruleType: NotificationRuleType) {
  return ruleType === 'DAILY_BRIEFING';
}

export default function NotificationSettings() {
  const [rules, setRules] = useState<NotificationRuleResponse[]>([]);
  const [events, setEvents] = useState<NotificationEventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [ruleType, setRuleType] = useState<NotificationRuleType>('INACTIVITY');
  const [channel, setChannel] = useState<NotificationChannel>('DISCORD');
  const [thresholdMinutes, setThresholdMinutes] = useState('60');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  const load = useCallback(async () => {
    const [ruleData, eventData] = await Promise.all([
      threadKeeperClient.listNotificationRules(),
      threadKeeperClient.listNotificationEvents(),
    ]);
    setRules(ruleData);
    setEvents(eventData);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        await load();
      } catch (err) {
        setError(describeApiError(err, 'Failed to load notification settings'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [load]);

  const runAction = async (name: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      await load();
      if (done) setNotice(typeof result === 'string' ? result : done);
    } catch (err) {
      setError(describeApiError(err, `Failed to ${name}`));
    } finally {
      setBusy(null);
    }
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    runAction(
      'create the rule',
      () =>
        threadKeeperClient.createNotificationRule({
          ruleType,
          enabled: true,
          channel,
          thresholdMinutes: usesThreshold(ruleType) ? Number(thresholdMinutes) : null,
          scheduledTime: usesSchedule(ruleType) ? scheduledTime : null,
          configJson: '{}',
        }),
      'Rule created.',
    );
  };

  if (loading) return <div>Loading notification settings...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '760px' }}>
      <Link href="/">← Back</Link>
      <h1>Notifications &amp; Rules</h1>
      <p>Control reminder noise: which events notify you, how often, and through which channel.</p>

      {error && <p role="alert">Error: {error}</p>}
      {notice && <p role="status">{notice}</p>}

      <section style={{ marginBottom: '30px' }}>
        <h2>Rules ({rules.length})</h2>
        {rules.length === 0 ? (
          <p>No rules yet. Nothing will be sent until you add one.</p>
        ) : (
          <ul>
            {rules.map((rule) => (
              <li key={rule.id} style={{ marginBottom: '10px' }}>
                <strong>{rule.ruleType}</strong> via {rule.channel} —{' '}
                {rule.enabled ? 'enabled' : 'disabled'}
                {rule.thresholdMinutes !== null && ` · after ${rule.thresholdMinutes}m`}
                {rule.scheduledTime && ` · at ${rule.scheduledTime}`}{' '}
                <button
                  onClick={() =>
                    runAction(
                      `toggle rule ${rule.id}`,
                      () =>
                        threadKeeperClient.updateNotificationRule(rule.id, {
                          enabled: !rule.enabled,
                          channel: rule.channel,
                          thresholdMinutes: rule.thresholdMinutes,
                          scheduledTime: rule.scheduledTime,
                          configJson: rule.configJson,
                        }),
                      rule.enabled ? 'Rule disabled.' : 'Rule enabled.',
                    )
                  }
                  disabled={busy !== null}
                >
                  {rule.enabled ? 'Disable' : 'Enable'}
                </button>{' '}
                <button
                  onClick={() =>
                    runAction(
                      `delete rule ${rule.id}`,
                      () => threadKeeperClient.deleteNotificationRule(rule.id),
                      'Rule deleted.',
                    )
                  }
                  disabled={busy !== null}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2>Add a rule</h2>
        <form onSubmit={onCreate}>
          <label htmlFor="ruleType">Rule type</label>{' '}
          <select
            id="ruleType"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as NotificationRuleType)}
          >
            {RULE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>{' '}
          <label htmlFor="channel">Channel</label>{' '}
          <select
            id="channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as NotificationChannel)}
          >
            {CHANNELS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>{' '}
          {usesThreshold(ruleType) && (
            <>
              <label htmlFor="thresholdMinutes">Inactive after (minutes)</label>{' '}
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
              <label htmlFor="scheduledTime">Briefing time</label>{' '}
              <input
                id="scheduledTime"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />{' '}
            </>
          )}
          <button type="submit" disabled={busy !== null}>
            {busy === 'create the rule' ? 'Adding...' : 'Add Rule'}
          </button>
          <p>{RULE_HELP[ruleType]}</p>
        </form>
      </section>

      <section>
        <h2>Recent events ({events.length})</h2>
        <p>
          Evaluation and dispatch run on a schedule; these buttons only make them happen now.{' '}
          <button
            onClick={() =>
              runAction(
                'evaluate rules',
                async () => {
                  const result = await threadKeeperClient.evaluateNotificationRules();
                  return `Queued ${result.queuedCount} notification(s).`;
                },
                'Evaluated.',
              )
            }
            disabled={busy !== null}
          >
            Evaluate now
          </button>{' '}
          <button
            onClick={() =>
              runAction(
                'dispatch notifications',
                async () => {
                  const result = await threadKeeperClient.dispatchNotifications();
                  return `Dispatched ${result.dispatchedCount} notification(s).`;
                },
                'Dispatched.',
              )
            }
            disabled={busy !== null}
          >
            Dispatch now
          </button>
        </p>
        {events.length === 0 ? (
          <p>Nothing queued or sent yet.</p>
        ) : (
          <ul>
            {events.slice(0, 15).map((event) => (
              <li key={event.id}>
                {event.eventType} · {event.channel} · <strong>{event.deliveryStatus}</strong> ·{' '}
                {new Date(event.createdAt).toLocaleString()}
                {event.threadId !== null && (
                  <>
                    {' '}
                    <Link href={`/threads/${event.threadId}`}>thread {event.threadId}</Link>
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
