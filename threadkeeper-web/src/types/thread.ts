export type ThreadStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type ThreadPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DriftStatus = 'ON_TRACK' | 'DRIFTING' | 'OFF_COURSE';

export interface SourceSessionResponse {
  id: number;
  threadId: number;
  providerSessionKey: string;
  sourceType: string;
  sourcePath: string;
  title: string;
  metadataJson: string;
  importedAt: string;
}

export interface ThreadSnapshotResponse {
  id: number;
  threadId: number;
  snapshotType: string;
  contentJson: string;
  createdAt: string;
}

export interface HandoffResponse {
  id: number;
  threadId: number;
  draftContent: string;
  finalContent: string | null;
  status: string;
  createdAt: string;
}

export interface NotificationEventResponse {
  id: number;
  threadId: number;
  ruleType: string;
  eventDataJson: string;
  processedAt: string | null;
  createdAt: string;
}

export interface ThreadDetailResponse {
  id: number;
  projectKey: string;
  title: string;
  status: ThreadStatus;
  priority: ThreadPriority;
  originalIntent: string;
  todayGoal: string;
  doneCondition: string;
  currentNextAction: string;
  driftStatus: DriftStatus;
  lastActivityAt: string;
  completedAt: string | null;
  createdAt: string;
  sourceSessions: SourceSessionResponse[];
  snapshots: ThreadSnapshotResponse[];
  handoffs: HandoffResponse[];
  notificationEvents: NotificationEventResponse[];
}

export interface ThreadResponse {
  id: number;
  projectKey: string;
  title: string;
  status: ThreadStatus;
  priority: ThreadPriority;
  originalIntent: string;
  todayGoal: string;
  doneCondition: string;
  currentNextAction: string;
  driftStatus: DriftStatus;
  lastActivityAt: string;
  completedAt: string | null;
  createdAt: string;
}
