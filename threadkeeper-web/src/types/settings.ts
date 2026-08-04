// Mirrors the notification and provider DTOs -- see the note in types/thread.ts.
import { NotificationChannel, NotificationRuleType, ProviderType } from '@/types/thread';

export interface NotificationRuleResponse {
  id: number;
  ruleType: NotificationRuleType;
  enabled: boolean;
  channel: NotificationChannel;
  thresholdMinutes: number | null;
  scheduledTime: string | null;
  configJson: string;
}

export interface EvaluateNotificationRulesResponse {
  queuedCount: number;
}

export interface DispatchNotificationsResponse {
  dispatchedCount: number;
}

export type ProviderConnectionStatus = 'ACTIVE' | 'ERROR' | 'DISCONNECTED';

export interface ProviderConnectionResponse {
  id: number;
  provider: ProviderType;
  accountLabel: string | null;
  homePath: string | null;
  status: ProviderConnectionStatus;
  lastImportAt: string | null;
  lastErrorMessage: string | null;
  importedSessionCount: number;
}

export interface ResetConnectionImportsResponse {
  threadsDeleted: number;
  sourceSessionsDeleted: number;
  snapshotsDeleted: number;
}
