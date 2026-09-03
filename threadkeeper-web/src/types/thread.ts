// These types mirror the API DTOs exactly. When a backend record changes,
// change it here in the same commit -- nothing else validates this contract.
//
// Sources:
//   ThreadResponse            <- thread/dto/ThreadResponse.java
//   ThreadDetailResponse      <- thread/dto/ThreadDetailResponse.java
//   SourceSessionResponse     <- source/dto/SourceSessionResponse.java
//   ThreadSnapshotResponse    <- snapshot/dto/ThreadSnapshotResponse.java
//   HandoffResponse           <- handoff/dto/HandoffResponse.java
//   NotificationEventResponse <- notification/dto/NotificationEventResponse.java

export type ThreadStatus = 'ACTIVE' | 'PAUSED' | 'BLOCKED' | 'COMPLETED';
export type ThreadPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type DriftStatus = 'ON_TRACK' | 'DRIFTING' | 'BLOCKED' | 'COMPLETED';
export type SnapshotType = 'INITIAL_INTENT' | 'PROGRESS' | 'DAILY_BRIEF' | 'COMPLETION';
export type HandoffStatus = 'DRAFT' | 'READY' | 'USED';
export type ProviderType = 'CLAUDE' | 'CODEX' | 'GEMINI' | 'GPT';
export type NotificationRuleType = 'INACTIVITY' | 'COMPLETION' | 'DAILY_BRIEFING' | 'DRIFT_ALERT';
export type NotificationChannel = 'DESKTOP' | 'DISCORD' | 'EMAIL';
export type NotificationDeliveryStatus = 'QUEUED' | 'SENT' | 'FAILED';

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
  snapshotType: SnapshotType;
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
  eventType: NotificationRuleType;
  channel: NotificationChannel;
  payloadJson: string;
  deliveryStatus: NotificationDeliveryStatus;
  sentAt: string | null;
  createdAt: string;
}

/** POST /threads/{id}/drift-evaluation -- mirrors drift/dto/DriftEvaluationResponse.java. */
export interface DriftEvaluationResponse {
  threadId: number;
  /** False when there was not enough activity to judge; the stored status is left alone. */
  conclusive: boolean;
  driftScore: number | null;
  driftStatus: DriftStatus;
  explanation: string;
}

/** GET /threads -- the list projection; narrower than the detail record, which also carries the related collections. */
export interface ThreadResponse {
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
  /** 0-100; null until there is enough activity to compare against the intent. */
  driftScore: number | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** GET /threads/{id} -- adds the goal fields, timestamps, and the related collections. */
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
  driftScore: number | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  createdAt: string;
  sourceSessions: SourceSessionResponse[];
  snapshots: ThreadSnapshotResponse[];
  handoffs: HandoffResponse[];
  notificationEvents: NotificationEventResponse[];
}
