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
  constructor(private readonly access: (workspaceId: string, id: string) => DatabaseAdminObjectEntry) {}

  private check(workspaceId: string, id: string, entry: DatabaseAdminObjectEntry, signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (this.access(workspaceId, id) !== entry || entry.session.workspaceId !== workspaceId) throw new DatabaseInputError('专属对象读取会话已变化。');
    if (entry.saving) throw new DatabaseInputError('当前会话正在执行写事务，请稍后刷新专属对象目录。');
  }
  private adapter(workspaceId: string, id: string): AdminObjectAdapter {
    const entry = this.access(workspaceId, id);
    this.check(workspaceId, id, entry);
    return {
      provider: entry.session.provider, database: entry.session.database,
      query: async (sql, parameters, maxRows, signal) => {
        this.check(workspaceId, id, entry, signal);
        const result = await entry.driver.read(sql, null, maxRows, parameters, signal);
        this.check(workspaceId, id, entry, signal);
        if (result.hasMore) throw new DatabaseInputError('原生专属目录查询超过服务读取范围。');
        return result.rows.map(row => Object.fromEntries(result.columns.map((name, index) => [name, row[index]])));
      },
    };
  }
  async list(workspaceId: string, id: string, value: unknown, signal?: AbortSignal): Promise<DatabaseAdminObjectList> {
    const entry = this.access(workspaceId, id);
    const adapter = this.adapter(workspaceId, id), input = adminObjectListInput(adapter.provider, value);
    signal?.throwIfAborted();
    const result = await (input.kind === 'event' ? listMySqlEvents(adapter, input, signal) : listPostgresExtensions(adapter, input, signal));
    this.check(workspaceId, id, entry, signal);
    return result;
  }
  async details(workspaceId: string, id: string, value: unknown, signal?: AbortSignal): Promise<DatabaseAdminObjectDetails> {
    const entry = this.access(workspaceId, id);
    const adapter = this.adapter(workspaceId, id), input = adminObjectDetailsInput(adapter.provider, value);
    signal?.throwIfAborted();
    const result = await (input.kind === 'event' ? describeMySqlEvent(adapter, input.schema, input.name, signal) : describePostgresExtension(adapter, input.name, signal));
    this.check(workspaceId, id, entry, signal);
    return result;
  }
}
