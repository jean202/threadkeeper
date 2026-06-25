export interface PortfolioReadiness {
  projectKey: string;
  readiness: number;
  baseReadiness: number;
  scannedAt: string | null;
  stale: boolean;
  ageDays: number;
  daysSinceLastCommit: number | null;
  active: boolean | null;
  lastCommitDate: string | null;
}
