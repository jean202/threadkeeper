import { ProviderType, SourceSessionResponse } from '@/types/thread';

export type ProviderConnectionStatus = 'ACTIVE' | 'ERROR' | 'DISCONNECTED';

export interface ProviderConnectionResponse {
  id: number;
  provider: ProviderType;
  accountLabel: string | null;
  homePath: string | null;
  status: ProviderConnectionStatus;
  lastImportAt: string | null;
  lastErrorMessage: string | null;
}

export interface CreateProviderConnectionRequest {
  provider: ProviderType;
  accountLabel: string | null;
  homePath: string | null;
}

export interface LatestImportResponse {
  connectionId: number;
  provider: ProviderType;
  status: ProviderConnectionStatus;
  lastImportAt: string | null;
  lastErrorMessage: string | null;
  importedSessionCount: number;
  linkedThreadCount: number;
  // From the imported rows, so it stays behind lastImportAt when a run imported nothing.
  latestSessionImportedAt: string | null;
  recentSessions: SourceSessionResponse[];
}

export interface RunProviderImportRequest {
  migratorPath: string;
  bridgePath?: string | null;
  profile?: string | null;
  target?: string | null;
  includeSensitive: boolean;
}

export interface ResetConnectionImportsResponse {
  threadsDeleted: number;
  sourceSessionsDeleted: number;
  snapshotsDeleted: number;
}
