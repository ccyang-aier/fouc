import type { RelationalSavedConnection, RedisSavedConnection } from '@fouc/shared';
import type { MongoSavedConnection } from '@fouc/shared/mongo-connections';
import type { ConnectionDirectoryMetadata } from '@fouc/shared/connection-directory';
import type { ConnectionListRow } from './types';

export type SavedDatastoreConnection = RelationalSavedConnection | RedisSavedConnection | MongoSavedConnection;
export type DatastoreProvider = SavedDatastoreConnection['config']['provider'];
export const emptyDirectory: ConnectionDirectoryMetadata = { favorite: false, projectIds: [], tags: [] };

/** Provider differences stop here; the directory view never knows native configuration shapes. */
export const directoryProviders: Record<DatastoreProvider, { label: string; family: string; targetLabel: string }> = {
  sqlite: { label: 'SQLite', family: 'relational', targetLabel: '文件' },
  mysql: { label: 'MySQL', family: 'relational', targetLabel: '连接目标' },
  postgres: { label: 'PostgreSQL', family: 'relational', targetLabel: '连接目标' },
  redis: { label: 'Redis', family: 'redis', targetLabel: '连接目标' },
  mongodb: { label: 'MongoDB', family: 'mongo', targetLabel: '连接目标' },
};

export function connectionListRow(entry: SavedDatastoreConnection, testing: boolean): ConnectionListRow {
  const { config } = entry;
  const directory = entry.directory ?? emptyDirectory;
  const target = config.provider === 'sqlite'
    ? config.path.split(/[\\/]/).pop() || config.path
    : `${config.host}:${config.port}${config.provider === 'redis' ? ` / DB ${config.database}` : config.database ? ` / ${config.database}` : ''}`;
  return {
    id: entry.id, name: entry.name, target,
    targetTitle: config.provider === 'sqlite' ? config.path : target,
    ...directory,
    status: testing ? 'testing' : entry.status?.kind ?? 'untested',
    statusTitle: entry.status
      ? `上次连接验证${entry.status.kind === 'passed' ? '通过' : '失败'} · ${new Date(entry.status.checkedAt).toLocaleString()}。不代表当前在线状态。`
      : '尚未验证此连接；请先测试连接。',
  };
}
