export interface RedisMonitorRecord { sequence: number; message: string; truncated: boolean }
export type RedisMonitorFrame =
  | { type: 'ready'; maxRows: number; lineBytes: number; bufferBytes: number }
  | { type: 'rows'; records: RedisMonitorRecord[]; dropped: number }
  | { type: 'error'; message: string };
