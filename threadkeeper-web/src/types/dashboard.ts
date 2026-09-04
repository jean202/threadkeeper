// Mirrors dashboard/dto/*.java -- see the note in types/thread.ts.
import { DriftStatus, ThreadPriority, ThreadStatus } from '@/types/thread';

/** Why a thread surfaced on the dashboard, as inferred by DashboardService. */
export type ResumeReason =
  | 'COMPLETED'
  | 'BLOCKED'
  | 'DRIFTING'
  | 'STALE'
  | 'MISSING_NEXT_ACTION'
  | 'HIGH_PRIORITY'
  | 'READY';

export interface DashboardThread {
  threadId: number;
  title: string;
  priority: ThreadPriority;
  status: ThreadStatus;
  driftStatus: DriftStatus;
  driftScore: number | null;
  nextAction: string | null;
  resumeReason: ResumeReason;
  staleMinutes: number;
  score: number;
  lastActivityAt: string | null;
}

export interface TodayDashboardResponse {
  activeThreads: DashboardThread[];
  staleThreads: DashboardThread[];
  blockedThreads: DashboardThread[];
  completedToday: DashboardThread[];
  /**
   * Thread ids in resume order. Every id appears in activeThreads -- the API
   * sends ids rather than repeating the objects.
   */
  recommendedOrder: number[];
}

export interface BriefingResponse {
  headline: string;
  threads: DashboardThread[];
}
