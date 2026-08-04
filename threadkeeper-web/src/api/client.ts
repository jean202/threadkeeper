import axios, { AxiosInstance } from 'axios';
import {
  HandoffResponse,
  ProviderType,
  SnapshotType,
  ThreadDetailResponse,
  ThreadPriority,
  ThreadResponse,
  ThreadSnapshotResponse,
  ThreadStatus,
} from '@/types/thread';
import { PortfolioReadiness } from '@/types/portfolio';
import { BriefingResponse, TodayDashboardResponse } from '@/types/dashboard';

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

  async createSnapshot(
    threadId: number,
    data: { snapshotType: SnapshotType; summary: string; nextAction?: string; blockers?: string },
  ): Promise<ThreadSnapshotResponse> {
    const response = await this.client.post<ThreadSnapshotResponse>(`/threads/${threadId}/snapshots`, data);
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
