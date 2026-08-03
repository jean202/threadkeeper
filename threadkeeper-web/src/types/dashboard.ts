import { DriftStatus, ThreadPriority, ThreadStatus } from '@/types/thread';

export type ResumeReason =
  | 'BLOCKED'
  | 'DRIFTING'
  | 'STALE'
  | 'MISSING_NEXT_ACTION'
  | 'HIGH_PRIORITY'
  | 'READY';

export interface DashboardThread {
  threadId: number;
  projectKey: string;
  title: string;
  status: ThreadStatus;
  priority: ThreadPriority;
  driftStatus: DriftStatus;
  nextAction: string | null;
  resumeReason: ResumeReason;
  // null when the thread has no recorded activity yet.
  staleMinutes: number | null;
  lastActivityAt: string | null;
  completedAt: string | null;
}

export interface TodayDashboardResponse {
  activeThreads: DashboardThread[];
  staleThreads: DashboardThread[];
  blockedThreads: DashboardThread[];
  completedToday: DashboardThread[];
  // Thread ids in resume-priority order; resolve them against activeThreads.
  recommendedOrder: number[];
}

export interface BriefingThread {
  threadId: number;
  title: string;
  priority: ThreadPriority;
  driftStatus: DriftStatus;
  nextAction: string | null;
  resumeReason: ResumeReason;
  staleMinutes: number;
  score: number;
  lastActivityAt: string | null;
}

export interface BriefingResponse {
  headline: string;
  threads: BriefingThread[];
}
