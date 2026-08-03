import { ResumeReason } from '@/types/dashboard';

const RESUME_REASON_LABELS: Record<ResumeReason, string> = {
  BLOCKED: '막힘',
  DRIFTING: '방향 이탈',
  STALE: '멈춘 지 오래',
  MISSING_NEXT_ACTION: '다음 행동 없음',
  HIGH_PRIORITY: '우선순위 높음',
  READY: '바로 이어가기',
};

// Reasons that mean "this needs attention" rather than "this is fine".
const RESUME_REASON_WARNING: Record<ResumeReason, boolean> = {
  BLOCKED: true,
  DRIFTING: true,
  STALE: true,
  MISSING_NEXT_ACTION: true,
  HIGH_PRIORITY: false,
  READY: false,
};

export function resumeReasonLabel(reason: ResumeReason): string {
  return RESUME_REASON_LABELS[reason] ?? reason;
}

export function isWarningReason(reason: ResumeReason): boolean {
  return RESUME_REASON_WARNING[reason] ?? false;
}

/** staleMinutes is null when the thread has never recorded activity. */
export function formatStaleMinutes(minutes: number | null): string {
  if (minutes === null) return '활동 기록 없음';
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}
