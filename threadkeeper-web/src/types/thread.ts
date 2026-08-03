export type ThreadStatus = 'ACTIVE' | 'PAUSED' | 'BLOCKED' | 'COMPLETED';
export type ThreadPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type DriftStatus = 'ON_TRACK' | 'DRIFTING' | 'BLOCKED' | 'COMPLETED';
export type ProviderType = 'CLAUDE' | 'CODEX' | 'GEMINI' | 'GPT';
export type HandoffStatus = 'DRAFT' | 'READY' | 'USED';

export interface SourceSessionResponse {
  id: number;
  threadId: number | null;
  providerConnectionId: number;
  provider: ProviderType;
  providerSessionKey: string;
  sourceType: string | null;
  sourcePath: string | null;
  title: string | null;
  importedAt: string;
  metadataJson: string;
}

export interface ThreadSnapshotResponse {
  id: number;
  threadId: number;
  snapshotType: string;
  summary: string;
  nextAction: string | null;
  blockers: string | null;
  driftScore: number | null;
  driftStatus: DriftStatus | null;
  createdAt: string;
}

export interface HandoffResponse {
  id: number;
  threadId: number;
  sourceSessionId: number | null;
  targetProvider: ProviderType;
  reason: string | null;
  whatChanged: string | null;
  blockers: string | null;
  nextAction: string | null;
  filesNote: string | null;
  status: HandoffStatus;
  createdAt: string;
}

export interface NotificationEventResponse {
  id: number;
  threadId: number | null;
  ruleId: number | null;
  eventType: string;
  channel: string;
  payloadJson: string;
  deliveryStatus: string;
  sentAt: string | null;
  createdAt: string;
}

export interface ThreadDetailResponse {
  id: number;
  projectKey: string;
  title: string;
  status: ThreadStatus;
  priority: ThreadPriority;
  originalIntent: string;
  todayGoal: string | null;
  doneCondition: string | null;
  currentNextAction: string | null;
  driftStatus: DriftStatus;
  lastActivityAt: string | null;
  completedAt: string | null;
  createdAt: string;
  sourceSessions: SourceSessionResponse[];
  snapshots: ThreadSnapshotResponse[];
  handoffs: HandoffResponse[];
  notificationEvents: NotificationEventResponse[];
}

// The list endpoint returns a narrower projection than the detail endpoint:
// no todayGoal, doneCondition, completedAt or createdAt.
export interface ThreadResponse {
  id: number;
  projectKey: string;
  title: string;
  status: ThreadStatus;
  priority: ThreadPriority;
  originalIntent: string;
  currentNextAction: string | null;
  driftStatus: DriftStatus;
  lastActivityAt: string | null;
}
