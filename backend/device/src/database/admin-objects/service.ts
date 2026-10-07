import type { RelationalSession } from '@fouc/shared';
import type { DatabaseAdminObjectList, DatabaseAdminObjectDetails } from '@fouc/shared/database-admin-objects';
import type { RelationalDriver } from '../drivers/relational-driver';
import { DatabaseInputError } from '../input-error';
import { adminObjectDetailsInput, adminObjectListInput } from './input';
import { describeMySqlEvent, listMySqlEvents } from './mysql-events';
import { describePostgresExtension, listPostgresExtensions } from './postgres-extensions';
import type { AdminObjectAdapter } from './common';

export interface DatabaseAdminObjectEntry { session: RelationalSession; driver: RelationalDriver; saving: boolean }
/** One authorized native session; no arbitrary commands or mutation channel exist. */
export class DatabaseAdminObjectService {
  constructor(private readonly access: (id: string) => DatabaseAdminObjectEntry) {}

  private check(id: string, entry: DatabaseAdminObjectEntry, signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (this.access(id) !== entry) throw new DatabaseInputError('专属对象读取会话已变化。');
    if (entry.saving) throw new DatabaseInputError('当前会话正在执行写事务，请稍后刷新专属对象目录。');
  }
  private adapter(id: string): AdminObjectAdapter {
    const entry = this.access(id);
    this.check(id, entry);
    return {
      provider: entry.session.provider, database: entry.session.database,
      query: async (sql, parameters, maxRows, signal) => {
        this.check(id, entry, signal);
        const result = await entry.driver.read(sql, null, maxRows, parameters, signal);
        this.check(id, entry, signal);
        if (result.hasMore) throw new DatabaseInputError('原生专属目录查询超过服务读取范围。');
        return result.rows.map(row => Object.fromEntries(result.columns.map((name, index) => [name, row[index]])));
      },
    };
  }
  async list(id: string, value: unknown, signal?: AbortSignal): Promise<DatabaseAdminObjectList> {
    const entry = this.access(id);
    const adapter = this.adapter(id), input = adminObjectListInput(adapter.provider, value);
    signal?.throwIfAborted();
    const result = await (input.kind === 'event' ? listMySqlEvents(adapter, input, signal) : listPostgresExtensions(adapter, input, signal));
    this.check(id, entry, signal);
    return result;
  }
  async details(id: string, value: unknown, signal?: AbortSignal): Promise<DatabaseAdminObjectDetails> {
    const entry = this.access(id);
    const adapter = this.adapter(id), input = adminObjectDetailsInput(adapter.provider, value);
    signal?.throwIfAborted();
    const result = await (input.kind === 'event' ? describeMySqlEvent(adapter, input.schema, input.name, signal) : describePostgresExtension(adapter, input.name, signal));
    this.check(id, entry, signal);
    return result;
  }
}
