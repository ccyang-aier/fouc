import type { RelationalSession } from '@fouc/shared';
import type { RelationalDriver } from '../drivers/relational-driver';
import { DatabaseInputError } from '../input-error';
import { readDatabaseActivity } from './read';

type ActivityEntry = { session: RelationalSession; driver: RelationalDriver; saving: boolean };

/** A live session owns each sample; no shared cache or durable monitor session is created. */
export class DatabaseActivityService {
  private readonly pending = new Set<ActivityEntry>();

  constructor(private readonly access: (workspaceId: string, id: string) => ActivityEntry) {}

  async snapshot(workspaceId: string, id: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const entry = this.access(workspaceId, id);
    if (entry.saving) throw new DatabaseInputError('当前会话正在执行写入，监控采样暂缓；完成后可刷新。');
    if (this.pending.has(entry)) throw new DatabaseInputError('当前会话的监控采样尚未结束，请稍后刷新。');
    const check = () => {
      signal?.throwIfAborted();
      if (this.access(workspaceId, id) !== entry) throw new DatabaseInputError('监控会话已变化，请重新连接。');
    };
    this.pending.add(entry);
    try {
      const result = await readDatabaseActivity({
        provider: entry.session.provider,
        database: entry.session.database,
        scopeKey: JSON.stringify([workspaceId, id]),
        read: async (sql, maxRows, requestSignal) => {
          check();
          if (entry.saving) throw new DatabaseInputError('当前会话正在执行写入，监控采样暂缓。');
          const result = await entry.driver.read(sql, null, maxRows, undefined, requestSignal);
          check();
          return result;
        },
      }, signal);
      check();
      return result;
    } finally { this.pending.delete(entry); }
  }
}
