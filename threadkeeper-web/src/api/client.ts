import axios, { AxiosInstance } from 'axios';
import { ThreadDetailResponse, ThreadResponse } from '@/types/thread';

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
}

export const threadKeeperClient = new ThreadKeeperClient();
