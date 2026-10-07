import type { RelationalProvider } from './relational';

export const DATABASE_ACTIVITY_LIMITS = { processes: 500, statusRows: 2000, sqlCharacters: 65_536, samples: 60 } as const;
export type DatabaseActivitySection = 'status' | 'settings' | 'processes';

export interface DatabaseActivityProcess {
  /** Native identifier as text: MySQL connection IDs need not fit a JS safe integer. */
  id: string | null;
  user: string | null;
  database: string | null;
  client: string | null;
  application: string | null;
  backendType: string | null;
  command: string | null;
  state: string | null;
  wait: string | null;
  ageSeconds: string | null;
  query: string | null;
  queryTruncated: boolean;
  /** True only when identified by the same sampling query / physical connection. */
  own: boolean | null;
  masked: boolean;
}

export interface DatabaseActivityIssue {
  section: DatabaseActivitySection;
  message: string;
  code: string | null;
}

export interface DatabaseActivitySnapshot {
  provider: RelationalProvider;
  database: string;
  /** Public session identity, never an endpoint or credential. */
  scopeKey: string;
  capturedAt: number;
  durationMs: number;
  counters: Record<string, string | null>;
  settings: Record<string, string | null>;
  processes: DatabaseActivityProcess[];
  processesSupported: boolean;
  processesTruncated: boolean;
  sources: Record<DatabaseActivitySection, string | null>;
  metricScope: 'instance' | 'file';
  warnings: string[];
  issues: DatabaseActivityIssue[];
}

export type DatabaseActivityUnit = 'count' | 'count/s' | 'B' | 'B/s' | '%' | 's';
export interface DatabaseActivityMetric {
  id: string;
  label: string;
  unit: DatabaseActivityUnit;
  value: number | string | null;
  source: string;
  /** Raw cumulative value, when the displayed metric is a sampled rate. */
  counter: string | null;
}
