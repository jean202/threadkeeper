import axios, { AxiosInstance } from 'axios';
import {
  DriftEvaluationResponse,
  HandoffResponse,
  HandoffStatus,
  NotificationChannel,
  NotificationEventResponse,
  NotificationRuleType,
  ProviderType,
  SnapshotType,
  ThreadDetailResponse,
  ThreadPriority,
  ThreadResponse,
  ThreadSearchParams,
  ThreadSnapshotResponse,
  ThreadStatus,
} from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import { BriefingResponse, TodayDashboardResponse } from '@/types/dashboard';
import {
  DispatchNotificationsResponse,
  EvaluateNotificationRulesResponse,
  NotificationRuleResponse,
  LatestImportResponse,
  ProviderConnectionResponse,
  ResetConnectionImportsResponse,
} from '@/types/settings';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

/** Mirrors global/error/ApiErrorResponse.java. */
interface ApiErrorResponse {
  code: string;
  message: string;
  fieldErrors: { field: string; reason: string }[] | null;
}

/**
 * Turns an API failure into something worth showing a user. The API reports
 * validation problems per field, so surface those rather than a bare 400.
 */
export function describeApiError(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }
  const data = error.response?.data as ApiErrorResponse | undefined;
  if (!data) return error.message || fallback;
  const fields = data.fieldErrors?.map((f) => `${f.field}: ${f.reason}`) ?? [];
  return fields.length > 0 ? `${data.message} (${fields.join('; ')})` : data.message || fallback;
}

export class ThreadKeeperClient {
  private client: AxiosInstance;

  constructor(baseURL: string = API_BASE_URL) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Blank and undefined values are dropped rather than sent, so an untouched
   * filter field cannot narrow the result set.
   */
  async listThreads(params: ThreadSearchParams = {}): Promise<ThreadResponse[]> {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text !== '') query[key] = text;
    }
    const response = await this.client.get<ThreadResponse[]>('/threads', { params: query });
    return response.data;
  }

  async getThread(threadId: number): Promise<ThreadDetailResponse> {
    const response = await this.client.get<ThreadDetailResponse>(`/threads/${threadId}`);
    return response.data;
  }

  async createThread(data: {
    projectKey: string;
    title: string;
    priority: ThreadPriority;
    originalIntent: string;
    todayGoal: string;
    doneCondition: string;
  }): Promise<ThreadResponse> {
    const response = await this.client.post<ThreadResponse>('/threads', data);
    return response.data;
  }

  async updateThreadStatus(threadId: number, status: ThreadStatus): Promise<ThreadResponse> {
    const response = await this.client.patch<ThreadResponse>(`/threads/${threadId}/status`, { status });
    return response.data;
  }

  async evaluateDrift(threadId: number): Promise<DriftEvaluationResponse> {
    const response = await this.client.post<DriftEvaluationResponse>(
      `/threads/${threadId}/drift-evaluation`,
    );
    return response.data;
  }

  async createSnapshot(
    threadId: number,
    data: { snapshotType: SnapshotType; summary: string; nextAction?: string; blockers?: string },
  ): Promise<ThreadSnapshotResponse> {
    const response = await this.client.post<ThreadSnapshotResponse>(`/threads/${threadId}/snapshots`, data);
    return response.data;
  }

  async updateHandoff(
    handoffId: number,
    data: {
      targetProvider: ProviderType;
      reason: string | null;
      whatChanged: string | null;
      blockers: string | null;
      nextAction: string | null;
      filesNote: string | null;
      status?: HandoffStatus;
    },
  ): Promise<HandoffResponse> {
    const response = await this.client.patch<HandoffResponse>(`/handoffs/${handoffId}`, data);
    return response.data;
  }

  async generateHandoffDraft(
    threadId: number,
    data: { targetProvider: ProviderType; reasonHint?: string; sourceSessionId?: number },
  ): Promise<HandoffResponse> {
    const response = await this.client.post<HandoffResponse>(`/threads/${threadId}/handoffs/draft`, data);
    return response.data;
  }

  async updateNextAction(threadId: number, currentNextAction: string): Promise<ThreadResponse> {
    const response = await this.client.patch<ThreadResponse>(`/threads/${threadId}/next-action`, {
      currentNextAction,
    });
    return response.data;
  }

  async getTodayDashboard(): Promise<TodayDashboardResponse> {
    const response = await this.client.get<TodayDashboardResponse>('/dashboard/today');
    return response.data;
  }

  async getBriefing(): Promise<BriefingResponse> {
    const response = await this.client.get<BriefingResponse>('/dashboard/briefing');
    return response.data;
  }

  // --- notification rules and events (Screen D) ---

  async listNotificationRules(): Promise<NotificationRuleResponse[]> {
    const response = await this.client.get<NotificationRuleResponse[]>('/notification-rules');
    return response.data;
  }

  async createNotificationRule(data: {
    ruleType: NotificationRuleType;
    enabled: boolean;
    channel: NotificationChannel;
    thresholdMinutes: number | null;
    scheduledTime: string | null;
    configJson: string;
  }): Promise<NotificationRuleResponse> {
    const response = await this.client.post<NotificationRuleResponse>('/notification-rules', data);
    return response.data;
  }

  async updateNotificationRule(
    ruleId: number,
    data: {
      enabled: boolean;
      channel: NotificationChannel;
      thresholdMinutes: number | null;
      scheduledTime: string | null;
      configJson: string;
    },
  ): Promise<NotificationRuleResponse> {
    const response = await this.client.patch<NotificationRuleResponse>(
      `/notification-rules/${ruleId}`,
      data,
    );
    return response.data;
  }

  async deleteNotificationRule(ruleId: number): Promise<void> {
    await this.client.delete(`/notification-rules/${ruleId}`);
  }

  async listNotificationEvents(): Promise<NotificationEventResponse[]> {
    const response = await this.client.get<NotificationEventResponse[]>('/notification-events');
    return response.data;
  }

  async evaluateNotificationRules(): Promise<EvaluateNotificationRulesResponse> {
    const response = await this.client.post<EvaluateNotificationRulesResponse>(
      '/notification-events/evaluate',
    );
    return response.data;
  }

  async dispatchNotifications(): Promise<DispatchNotificationsResponse> {
    const response = await this.client.post<DispatchNotificationsResponse>(
      '/notification-events/dispatch',
    );
    return response.data;
  }

  // --- provider connections (Screen E) ---

  async listProviderConnections(): Promise<ProviderConnectionResponse[]> {
    const response = await this.client.get<ProviderConnectionResponse[]>('/provider-connections');
    return response.data;
  }

  async createProviderConnection(data: {
    provider: ProviderType;
    accountLabel: string;
    homePath: string;
  }): Promise<ProviderConnectionResponse> {
    const response = await this.client.post<ProviderConnectionResponse>('/provider-connections', data);
    return response.data;
  }

  async runProviderImport(
    connectionId: number,
    data: {
      migratorPath: string;
      bridgePath?: string;
      profile?: string;
      target?: string;
      includeSensitive: boolean;
    },
  ): Promise<unknown[]> {
    const response = await this.client.post<unknown[]>(
      `/provider-connections/${connectionId}/imports/run`,
      data,
    );
    return response.data;
  }

  async getLatestImport(connectionId: number): Promise<LatestImportResponse> {
    const response = await this.client.get<LatestImportResponse>(
      `/provider-connections/${connectionId}/imports/latest`,
    );
    return response.data;
  }

  async resetConnectionImports(connectionId: number): Promise<ResetConnectionImportsResponse> {
    const response = await this.client.delete<ResetConnectionImportsResponse>(
      `/provider-connections/${connectionId}/imports`,
    );
    return response.data;
  }

  async getPortfolioReadiness(): Promise<Map<string, PortfolioReadiness>> {
    try {
      const response = await this.client.get<PortfolioReadiness[]>('/portfolio-readiness');
      return new Map(response.data.map((item) => [item.projectKey, item]));
    } catch {
      // Graceful degradation: PT data is optional display context, never a hard failure.
      return new Map();
    }
  }
}

export const threadKeeperClient = new ThreadKeeperClient();
