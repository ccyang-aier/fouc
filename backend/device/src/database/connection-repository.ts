import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ConnectionDirectoryMetadata, ConnectionDirectoryStatus } from '@fouc/shared/connection-directory';
import { DatabaseInputError } from './input-error';

type Saved<Config> = {
  id: string; name: string; config: Config; updatedAt: number;
  directory?: ConnectionDirectoryMetadata; status?: ConnectionDirectoryStatus;
};

function directoryPatch(value: unknown): Partial<ConnectionDirectoryMetadata> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DatabaseInputError('连接目录设置无效');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['favorite', 'projectIds', 'tags'].includes(key)))
    throw new DatabaseInputError('连接目录包含不支持的字段');
  const result: Partial<ConnectionDirectoryMetadata> = {};
  if ('favorite' in input) {
    if (typeof input.favorite !== 'boolean') throw new DatabaseInputError('收藏设置无效');
    result.favorite = input.favorite;
  }
  for (const key of ['projectIds', 'tags'] as const) {
    if (!(key in input)) continue;
    const values = input[key];
    const limit = key === 'projectIds' ? 20 : 12;
    const maxLength = key === 'projectIds' ? 128 : 32;
    if (!Array.isArray(values) || values.length > limit || values.some((item) =>
      typeof item !== 'string' || !item.trim() || item.trim().length > maxLength))
      throw new DatabaseInputError(key === 'projectIds' ? '关联项目无效' : '连接标签无效');
    const normalized = values.map((item: string) => item.trim());
    if (new Set(normalized).size !== normalized.length)
      throw new DatabaseInputError(key === 'projectIds' ? '关联项目不能重复' : '连接标签不能重复');
    result[key] = normalized;
  }
  return result;
}

/** Nonsecret connection metadata owned by this device. */
export class DeviceConnectionRepository<Config> {
  constructor(
    private readonly directory: string,
    private readonly normalize: (value: unknown) => Config,
  ) {}
  private file(): string {
    return path.join(this.directory, 'connections.json');
  }
  list(): Saved<Config>[] {
    const file = this.file();
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  }
  get(id: string): Saved<Config> {
    const value = this.list().find((item) => item.id === id);
    if (!value) throw new DatabaseInputError('连接配置不存在');
    return value;
  }
  save(value: unknown, id: string = crypto.randomUUID()): Saved<Config> {
    if (!value || typeof value !== 'object') throw new DatabaseInputError('连接配置无效');
    const input = value as { name?: unknown; config?: unknown; directory?: unknown };
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120)
      throw new DatabaseInputError('连接名称无效');
    const entries = this.list();
    const previous = entries.find((item) => item.id === id);
    const config = this.normalize(input.config);
    const directory = {
      favorite: false, projectIds: [], tags: [], ...previous?.directory,
      ...('directory' in input ? directoryPatch(input.directory) : {}),
    };
    const entry: Saved<Config> = {
      id,
      name: input.name.trim(),
      config,
      updatedAt: Date.now(),
      directory,
      ...(previous?.status && JSON.stringify(previous.config) === JSON.stringify(config)
        ? { status: previous.status } : {}),
    };
    this.write([...entries.filter((item) => item.id !== id), entry]);
    return entry;
  }
  updateDirectory(id: string, value: unknown): Saved<Config> {
    const entry = this.get(id);
    const patch = directoryPatch(value);
    const updated: Saved<Config> = {
      ...entry,
      directory: { favorite: false, projectIds: [], tags: [], ...entry.directory, ...patch },
      updatedAt: Date.now(),
    };
    this.write(this.list().map((item) => item.id === id ? updated : item));
    return updated;
  }
  recordStatus(id: string, config: Config, kind: ConnectionDirectoryStatus['kind']): void {
    const entries = this.list();
    const entry = entries.find((item) => item.id === id);
    // An in-flight attempt must not restore a deleted profile or annotate a different target.
    if (!entry || JSON.stringify(entry.config) !== JSON.stringify(config)) return;
    this.write(entries.map((item) => item.id === id
      ? { ...item, status: { kind, checkedAt: Date.now() } } : item));
  }
  remove(id: string): void {
    this.get(id);
    this.write(
      this.list().filter((item) => item.id !== id),
    );
  }
  private write(entries: Saved<Config>[]) {
    mkdirSync(this.directory, { recursive: true });
    const file = this.file();
    writeFileSync(file + '.tmp', JSON.stringify(entries), { mode: 0o600 });
    renameSync(file + '.tmp', file);
  }
}
