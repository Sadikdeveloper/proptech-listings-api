export type HealthState = 'up' | 'down';

export interface DatabaseHealth {
  status: HealthState;
  latencyMs: number;
}

export interface HealthResponse {
  status: HealthState;
  uptimeSeconds: number;
  timestamp: string;
  database: DatabaseHealth;
}
