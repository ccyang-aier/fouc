import type { RelationalSession } from '@fouc/shared';
import type { RelationalDriver } from '../drivers/relational-driver';
import { DatabaseInputError } from '../input-error';
import { parseSecurityDetailQuery, readSecurityDetail, readSecurityDirectory, type SecurityAdapter } from './read';

type SecurityEntry = { session: RelationalSession; driver: RelationalDriver; saving: boolean };
export class DatabaseSecurityService {
  private readonly pending = new Set<SecurityEntry>();
  constructor(private readonly access: (id: string) => SecurityEntry) {}
  private async run<T>(id: string, signal: AbortSignal | undefined, operation: (adapter: SecurityAdapter, entry: SecurityEntry) => Promise<T>): Promise<T> {
    const entry = this.access(id);
    if (entry.session.provider === 'sqlite') throw new DatabaseInputError('SQLite 文件没有用户或角色目录。');
    if (entry.saving || this.pending.has(entry)) throw new DatabaseInputError('当前连接忙，请等待操作完成后刷新权限目录。');
    const check = () => {
      signal?.throwIfAborted();
      if (this.access(id) !== entry || entry.saving) throw new DatabaseInputError('连接已变化或正在写入，请重新读取权限目录。');
    };
    check(); this.pending.add(entry);
    try {
      const result = await operation({ provider: entry.session.provider, scopeKey: id, read: async (sql, limit, values) => { check(); const value = await entry.driver.read(sql, null, limit, values, signal); check(); return value; } }, entry);
      check(); return result;
    } finally { this.pending.delete(entry); }
  }
  directory(id: string, signal?: AbortSignal) { return this.run(id, signal, adapter => readSecurityDirectory(adapter)); }
  detail(id: string, value: unknown, signal?: AbortSignal) {
    const query = parseSecurityDetailQuery(value);
    return this.run(id, signal, async (adapter, entry) => {
      const directory = await readSecurityDirectory(adapter);
      const principal = directory.principals.find(item => item.id === query.principalId);
      if (!principal) throw new DatabaseInputError('账户不在当前可见原生目录中，请刷新后重新选择。');
      if (query.schema && !(await entry.driver.schemas()).includes(query.schema)) throw new DatabaseInputError('Schema 不在当前连接可见目录中。');
      signal?.throwIfAborted();
      return readSecurityDetail(adapter, principal, query.schema);
    });
  }
}
