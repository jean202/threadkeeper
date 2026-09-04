/**
 * Sample payloads shaped exactly like the API's, captured from a running
 * instance. They are typed as the response interfaces on purpose: if a DTO and
 * its interface drift apart, updating the interface breaks these fixtures at
 * compile time instead of at run time in the browser.
 */
import {
  HandoffResponse,
  NotificationEventResponse,
  SourceSessionResponse,
  ThreadDetailResponse,
  ThreadResponse,
  ThreadSnapshotResponse,
} from '@/types/thread';
import { DashboardThread, TodayDashboardResponse } from '@/types/dashboard';
import {
  LatestImportResponse,
  NotificationRuleResponse,
  ProviderConnectionResponse,
} from '@/types/settings';

export const sourceSession: SourceSessionResponse = {
  id: 1,
  threadId: 1,
  providerConnectionId: 1,
  provider: 'CODEX',
  providerSessionKey: 'sess-1',
  sourceType: 'rollout',
  sourcePath: '/tmp/rollout.jsonl',
  title: 'Contract fix session',
  importedAt: '2026-08-04T04:19:27.431677051Z',
  metadataJson: '{}',
};

export const snapshot: ThreadSnapshotResponse = {
  id: 1,
  threadId: 1,
  snapshotType: 'PROGRESS',
  summary: 'Types realigned',
  nextAction: 'Verify in browser',
  blockers: null,
  driftScore: null,
  driftStatus: null,
  createdAt: '2026-08-04T04:19:02.365417380Z',
};

export const handoff: HandoffResponse = {
  id: 1,
  threadId: 1,
  sourceSessionId: null,
  targetProvider: 'CLAUDE',
  reason: 'Continue in Claude',
  whatChanged: 'Original intent: Align web types with backend DTOs',
  blockers: 'No blockers captured yet.',
  nextAction: 'Ship type fix',
  filesNote: 'No source session linked yet.',
  status: 'DRAFT',
  createdAt: '2026-08-04T04:18:52.588280444Z',
};

export const notificationEvent: NotificationEventResponse = {
  id: 1,
  threadId: 1,
  ruleId: 1,
  eventType: 'INACTIVITY',
  channel: 'DISCORD',
  payloadJson: '{"message":"Thread inactive","threadId":1,"inactiveMinutes":0}',
  deliveryStatus: 'QUEUED',
  sentAt: null,
  createdAt: '2026-08-04T04:19:02.486270Z',
};

export const threadDetail: ThreadDetailResponse = {
  id: 1,
  projectKey: 'threadkeeper',
  title: 'Fix web API contract',
  status: 'ACTIVE',
  priority: 'HIGH',
  originalIntent: 'Align web types with backend DTOs',
  todayGoal: 'Ship type fix',
  doneCondition: 'detail page renders',
  currentNextAction: 'verify',
  driftStatus: 'ON_TRACK',
  driftScore: 40,
  lastActivityAt: '2026-08-04T04:00:00Z',
  completedAt: null,
  createdAt: '2026-08-04T04:18:51.196124Z',
  sourceSessions: [sourceSession],
  snapshots: [snapshot],
  handoffs: [handoff],
  notificationEvents: [notificationEvent],
};

export const threadListItem: ThreadResponse = {
  id: 1,
  projectKey: 'threadkeeper',
  title: 'Align web types with backend DTOs',
  status: 'ACTIVE',
  priority: 'HIGH',
  originalIntent: 'Make the web client match the API contract',
  todayGoal: 'Ship the type fix',
  doneCondition: 'Handoff page renders without crashing',
  currentNextAction: 'Verify in browser',
  driftStatus: 'ON_TRACK',
  driftScore: 12,
  lastActivityAt: '2026-08-04T04:19:27.431677051Z',
  completedAt: null,
  createdAt: '2026-08-03T09:00:00.000000000Z',
};

export const dashboardThread: DashboardThread = {
  threadId: 1,
  title: 'Fix web API contract',
  priority: 'HIGH',
  status: 'ACTIVE',
  driftStatus: 'ON_TRACK',
  driftScore: 40,
  nextAction: 'verify',
  resumeReason: 'STALE',
  staleMinutes: 480,
  score: 95,
  lastActivityAt: '2026-08-03T21:44:26.810805Z',
};

export const driftingThread: DashboardThread = {
  ...dashboardThread,
  threadId: 8,
  title: 'Billing webhook retries',
  driftStatus: 'DRIFTING',
  driftScore: 100,
  resumeReason: 'DRIFTING',
  staleMinutes: 0,
};

export const todayDashboard: TodayDashboardResponse = {
  activeThreads: [dashboardThread, driftingThread],
  staleThreads: [dashboardThread],
  blockedThreads: [],
  completedToday: [],
  recommendedOrder: [dashboardThread, driftingThread],
};

export const notificationRule: NotificationRuleResponse = {
  id: 1,
  ruleType: 'INACTIVITY',
  enabled: true,
  channel: 'DISCORD',
  thresholdMinutes: 60,
  scheduledTime: null,
  configJson: '{}',
};

export const providerConnection: ProviderConnectionResponse = {
  id: 1,
  provider: 'CODEX',
  accountLabel: 'default',
  homePath: '/home/user',
  status: 'ACTIVE',
  lastImportAt: '2026-08-04T04:19:27Z',
  lastErrorMessage: null,
  importedSessionCount: 3,
};

export const latestImport: LatestImportResponse = {
  connectionId: 1,
  provider: 'CODEX',
  status: 'ACTIVE',
  lastImportAt: '2026-08-04T06:00:00Z',
  lastErrorMessage: null,
  importedSessionCount: 3,
  linkedThreadCount: 2,
  latestSessionImportedAt: '2026-08-04T04:19:27Z',
  recentSessions: [sourceSession],
};
