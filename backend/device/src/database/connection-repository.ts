import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseInputError } from './input-error';

type Saved<Config> = { id: string; workspaceId: string; name: string; config: Config; updatedAt: number };

/** Nonsecret metadata on the owning device; a workspace cannot read another file. */
export class DeviceConnectionRepository<Config> {
  constructor(
    private readonly directory: string,
    private readonly normalize: (value: unknown) => Config,
  ) {}
  private file(workspaceId: string): string {
    if (!workspaceId.trim() || workspaceId.length > 128) throw new DatabaseInputError('工作空间无效');
    return path.join(this.directory, createHash('sha256').update(workspaceId).digest('hex') + '.json');
  }
  list(workspaceId: string): Saved<Config>[] {
    const file = this.file(workspaceId);
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  }
  get(workspaceId: string, id: string): Saved<Config> {
    const value = this.list(workspaceId).find((item) => item.id === id);
    if (!value) throw new DatabaseInputError('当前工作空间中的连接配置不存在');
    return value;
  }
  save(workspaceId: string, value: unknown, id: string = crypto.randomUUID()): Saved<Config> {
    if (!value || typeof value !== 'object') throw new DatabaseInputError('连接配置无效');
    const input = value as { name?: unknown; config?: unknown };
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120)
      throw new DatabaseInputError('连接名称无效');
    const entry = {
      id,
      workspaceId,
      name: input.name.trim(),
      config: this.normalize(input.config),
      updatedAt: Date.now(),
    };
    this.write(workspaceId, [...this.list(workspaceId).filter((item) => item.id !== id), entry]);
    return entry;
  }
  remove(workspaceId: string, id: string): void {
    this.get(workspaceId, id);
    this.write(
      workspaceId,
      this.list(workspaceId).filter((item) => item.id !== id),
    );
  }
  private write(workspaceId: string, entries: Saved<Config>[]) {
    mkdirSync(this.directory, { recursive: true });
    const file = this.file(workspaceId);
    writeFileSync(file + '.tmp', JSON.stringify(entries), { mode: 0o600 });
    renameSync(file + '.tmp', file);
  }
}
