import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RelationalConnectionConfig, RelationalSavedConnection } from '@fouc/shared';
import { RelationalInputError } from './relational-sql';

/** Device-owned connection metadata, scoped to workspace. Never stores secrets. */
export class RelationalConnectionRepository {
  constructor(private readonly directory: string) {}
  private file(workspaceId: string): string {
    if (!workspaceId.trim() || workspaceId.length > 128) throw new RelationalInputError('工作空间无效');
    return path.join(this.directory, createHash('sha256').update(workspaceId).digest('hex') + '.json');
  }
  list(workspaceId: string): RelationalSavedConnection[] {
    const file = this.file(workspaceId);
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  }
  get(workspaceId: string, id: string): RelationalSavedConnection {
    const value = this.list(workspaceId).find((item) => item.id === id);
    if (!value) throw new RelationalInputError('当前工作空间中的连接配置不存在');
    return value;
  }
  save(workspaceId: string, value: unknown, id: string = crypto.randomUUID()): RelationalSavedConnection {
    if (!value || typeof value !== 'object') throw new RelationalInputError('连接配置无效');
    const input = value as { name?: unknown; config?: Record<string, unknown> };
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120 || !input.config)
      throw new RelationalInputError('连接名称或配置无效');
    const raw = input.config;
    let config: RelationalConnectionConfig;
    if (
      raw.provider === 'postgres' &&
      typeof raw.host === 'string' &&
      raw.host.trim() &&
      Number.isInteger(raw.port) &&
      Number(raw.port) > 0 &&
      Number(raw.port) <= 65535 &&
      typeof raw.username === 'string' &&
      raw.username.trim() &&
      typeof raw.database === 'string' &&
      raw.database.trim() &&
      (raw.ssl === undefined || typeof raw.ssl === 'boolean')
    ) {
      config = {
        provider: 'postgres',
        host: raw.host.trim(),
        port: Number(raw.port),
        username: raw.username.trim(),
        database: raw.database.trim(),
        ssl: raw.ssl === true,
      };
    } else if (raw.provider === 'sqlite' && typeof raw.path === 'string' && path.isAbsolute(raw.path))
      config = { provider: 'sqlite', path: raw.path };
    else throw new RelationalInputError('连接参数无效');
    const entry: RelationalSavedConnection = {
      id,
      workspaceId,
      name: input.name.trim(),
      config,
      updatedAt: Date.now(),
    };
    const current = this.list(workspaceId).filter((item) => item.id !== id);
    this.write(workspaceId, [...current, entry]);
    return entry;
  }
  remove(workspaceId: string, id: string): void {
    this.get(workspaceId, id);
    this.write(
      workspaceId,
      this.list(workspaceId).filter((item) => item.id !== id),
    );
  }
  private write(workspaceId: string, entries: RelationalSavedConnection[]) {
    mkdirSync(this.directory, { recursive: true });
    const file = this.file(workspaceId);
    writeFileSync(file + '.tmp', JSON.stringify(entries), { mode: 0o600 });
    renameSync(file + '.tmp', file);
  }
}
