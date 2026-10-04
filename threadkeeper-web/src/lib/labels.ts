/**
 * Korean display names for the API's enum values. The values themselves stay
 * in English -- they are what the API sends and expects -- so only what the
 * user reads goes through here. One table per enum keeps every screen naming
 * a status the same way.
 */
import {
  DriftStatus,
  HandoffStatus,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationRuleType,
  ProviderType,
  SnapshotType,
  ThreadPriority,
  ThreadStatus,
} from '@/types/thread';
import { ProviderConnectionStatus } from '@/types/settings';
import { ResumeReason } from '@/types/dashboard';

export const STATUS_LABEL: Record<ThreadStatus, string> = {
  ACTIVE: '진행 중',
  PAUSED: '보류',
  BLOCKED: '막힘',
  COMPLETED: '완료',
};

export const PRIORITY_LABEL: Record<ThreadPriority, string> = {
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
};

export const DRIFT_LABEL: Record<DriftStatus, string> = {
  ON_TRACK: '정상 진행',
  DRIFTING: '방향 이탈',
  BLOCKED: '막힘',
  COMPLETED: '완료',
};

export const SNAPSHOT_LABEL: Record<SnapshotType, string> = {
  INITIAL_INTENT: '처음 의도',
  PROGRESS: '진행 기록',
  DAILY_BRIEF: '일일 요약',
  COMPLETION: '완료 기록',
};

export const HANDOFF_STATUS_LABEL: Record<HandoffStatus, string> = {
  DRAFT: '초안',
  READY: '준비 완료',
  USED: '사용됨',
};

/** Product names stay as they are; only the casing is made readable. */
export const PROVIDER_LABEL: Record<ProviderType, string> = {
  CLAUDE: 'Claude',
  CODEX: 'Codex',
  GEMINI: 'Gemini',
  GROK: 'Grok',
};

export const RULE_TYPE_LABEL: Record<NotificationRuleType, string> = {
  INACTIVITY: '오래 멈춘 스레드',
  COMPLETION: '스레드 완료',
  DAILY_BRIEFING: '아침 브리핑',
  DRIFT_ALERT: '방향 이탈',
};

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  DESKTOP: '데스크톱',
  DISCORD: '디스코드',
  EMAIL: '이메일',
};

export const DELIVERY_LABEL: Record<NotificationDeliveryStatus, string> = {
  QUEUED: '대기 중',
  SENT: '보냄',
  FAILED: '실패',
};

export const CONNECTION_STATUS_LABEL: Record<ProviderConnectionStatus, string> = {
  ACTIVE: '정상',
  ERROR: '오류',
  DISCONNECTED: '연결 끊김',
};

export const RESUME_REASON_LABEL: Record<ResumeReason, string> = {
  COMPLETED: '완료됨',
  BLOCKED: '막혀 있음',
  DRIFTING: '처음 의도에서 벗어나는 중',
  STALE: '한동안 손대지 않음',
  MISSING_NEXT_ACTION: '다음 할 일이 정해지지 않음',
  HIGH_PRIORITY: '우선순위 높음',
  READY: '바로 이어서 할 수 있음',
};

/**
 * Falls back to the raw value, so an enum value the api adds later still
 * shows up as something rather than as a blank.
 */
export function label<K extends string>(table: Record<K, string>, value: K | null | undefined): string {
  if (value == null) return '—';
  return table[value] ?? value;
}
