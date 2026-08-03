import axios, { AxiosInstance } from 'axios';
import {
  HandoffResponse,
  HandoffStatus,
  NotificationEventResponse,
  ProviderType,
  SourceSessionResponse,
  ThreadDetailResponse,
  ThreadResponse,
} from '@/types/thread';
import {
  CreateProviderConnectionRequest,
  LatestImportResponse,
  ProviderConnectionResponse,
  ResetConnectionImportsResponse,
  RunProviderImportRequest,
} from '@/types/provider';
import {
  CreateNotificationRuleRequest,
  DispatchNotificationsResponse,
  EvaluateNotificationRulesResponse,
  NotificationRuleResponse,
  UpdateNotificationRuleRequest,
} from '@/types/notification';
import { BriefingResponse, TodayDashboardResponse } from '@/types/dashboard';
import { PortfolioReadiness } from '@/types/portfolio';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

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

  async listThreads(): Promise<ThreadResponse[]> {
    const response = await this.client.get<ThreadResponse[]>('/threads');
    return response.data;
  }

  async getThread(threadId: number): Promise<ThreadDetailResponse> {
    const response = await this.client.get<ThreadDetailResponse>(`/threads/${threadId}`);
    return response.data;
  }

  async createThread(data: {
    projectKey: string;
    title: string;
    priority: string;
    originalIntent: string;
    todayGoal: string;
    doneCondition: string;
  }): Promise<ThreadResponse> {
    const response = await this.client.post<ThreadResponse>('/threads', data);
    return response.data;
  }

  async updateThreadStatus(threadId: number, status: string): Promise<ThreadResponse> {
    const response = await this.client.patch<ThreadResponse>(`/threads/${threadId}/status`, { status });
    return response.data;
  }

  async updateNextAction(threadId: number, currentNextAction: string): Promise<ThreadResponse> {
    const response = await this.client.patch<ThreadResponse>(`/threads/${threadId}/next-action`, {
      currentNextAction,
    });
    return response.data;
  }

  async listHandoffs(threadId: number): Promise<HandoffResponse[]> {
    const response = await this.client.get<HandoffResponse[]>(`/threads/${threadId}/handoffs`);
    return response.data;
  }

  async createHandoff(
    threadId: number,
    data: {
      sourceSessionId?: number | null;
      targetProvider: ProviderType;
      reason?: string | null;
      whatChanged?: string | null;
      blockers?: string | null;
      nextAction?: string | null;
      filesNote?: string | null;
      status?: HandoffStatus | null;
    },
  ): Promise<HandoffResponse> {
    const response = await this.client.post<HandoffResponse>(
      `/threads/${threadId}/handoffs`,
      data,
    );
    return response.data;
  }

  async generateHandoffDraft(
    threadId: number,
    data: { targetProvider: ProviderType; sourceSessionId?: number | null; reasonHint?: string | null },
  ): Promise<HandoffResponse> {
    const response = await this.client.post<HandoffResponse>(
      `/threads/${threadId}/handoffs/draft`,
      data,
    );
    return response.data;
  }

  async updateHandoffStatus(handoffId: number, status: HandoffStatus): Promise<HandoffResponse> {
    const response = await this.client.patch<HandoffResponse>(`/handoffs/${handoffId}/status`, {
      status,
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

  async listNotificationRules(): Promise<NotificationRuleResponse[]> {
    const response = await this.client.get<NotificationRuleResponse[]>('/notification-rules');
    return response.data;
  }

  async createNotificationRule(
    data: CreateNotificationRuleRequest,
  ): Promise<NotificationRuleResponse> {
    const response = await this.client.post<NotificationRuleResponse>('/notification-rules', data);
    return response.data;
  }

  async updateNotificationRule(
    ruleId: number,
    data: UpdateNotificationRuleRequest,
  ): Promise<NotificationRuleResponse> {
    const response = await this.client.patch<NotificationRuleResponse>(
      `/notification-rules/${ruleId}`,
      data,
    );
    return response.data;
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

  async listProviderConnections(): Promise<ProviderConnectionResponse[]> {
    const response = await this.client.get<ProviderConnectionResponse[]>('/provider-connections');
    return response.data;
  }

  async createProviderConnection(
    data: CreateProviderConnectionRequest,
  ): Promise<ProviderConnectionResponse> {
    const response = await this.client.post<ProviderConnectionResponse>(
      '/provider-connections',
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

  async runProviderImport(
    connectionId: number,
    data: RunProviderImportRequest,
  ): Promise<SourceSessionResponse[]> {
    const response = await this.client.post<SourceSessionResponse[]>(
      `/provider-connections/${connectionId}/imports/run`,
      data,
    );
    return response.data;
  }

  async resetProviderImports(connectionId: number): Promise<ResetConnectionImportsResponse> {
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
