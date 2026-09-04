// Mirrors the notification and provider DTOs -- see the note in types/thread.ts.
import { NotificationChannel, NotificationRuleType, ProviderType, SourceSessionResponse } from '@/types/thread';

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

/**
 * GET /provider-connections/{id}/imports/latest -- mirrors
 * provider/dto/LatestImportResponse.java.
 *
 * `lastImportAt` is when a run was last attempted; `latestSessionImportedAt`
 * is when content last actually arrived. A run that found nothing new moves
 * the first and leaves the second alone.
 */
export interface LatestImportResponse {
  connectionId: number;
  provider: ProviderType;
  status: ProviderConnectionStatus;
  lastImportAt: string | null;
  lastErrorMessage: string | null;
  importedSessionCount: number;
  /** Distinct threads, not sessions -- several sessions may share a thread. */
  linkedThreadCount: number;
  latestSessionImportedAt: string | null;
  recentSessions: SourceSessionResponse[];
}

export interface ResetConnectionImportsResponse {
  threadsDeleted: number;
  sourceSessionsDeleted: number;
  snapshotsDeleted: number;
}
