export type NotificationRuleType = 'INACTIVITY' | 'COMPLETION' | 'DAILY_BRIEFING' | 'DRIFT_ALERT';
export type NotificationChannel = 'DESKTOP' | 'DISCORD' | 'EMAIL';
export type NotificationDeliveryStatus = 'QUEUED' | 'SENT' | 'FAILED';

export interface NotificationRuleResponse {
  id: number;
  ruleType: NotificationRuleType;
  enabled: boolean;
  channel: NotificationChannel;
  thresholdMinutes: number | null;
  scheduledTime: string | null;
  configJson: string;
}

export interface CreateNotificationRuleRequest {
  ruleType: NotificationRuleType;
  enabled: boolean;
  channel: NotificationChannel;
  thresholdMinutes: number | null;
  scheduledTime: string | null;
  configJson: string;
}

// Partial update: omitted fields keep their stored value. ruleType cannot be changed.
export interface UpdateNotificationRuleRequest {
  enabled?: boolean;
  channel?: NotificationChannel;
  thresholdMinutes?: number;
  scheduledTime?: string;
  configJson?: string;
}

export interface EvaluateNotificationRulesResponse {
  queuedCount: number;
}

export interface DispatchNotificationsResponse {
  dispatchedCount: number;
}
