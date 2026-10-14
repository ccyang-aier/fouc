import { getLocale } from '@/lib/i18n';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './provider-model.messages';
import type { RelationalSavedConnection, RedisSavedConnection } from '@fouc/shared';
import type { MongoSavedConnection } from '@fouc/shared/mongo-connections';
import type { ConnectionDirectoryMetadata } from '@fouc/shared/connection-directory';
import type { ConnectionListRow } from './types';
export type SavedDatastoreConnection =
  RelationalSavedConnection | RedisSavedConnection | MongoSavedConnection;
export type DatastoreProvider = SavedDatastoreConnection['config']['provider'];
export const emptyDirectory: ConnectionDirectoryMetadata = {
  favorite: false,
  projectIds: [],
  tags: [],
};
/** Provider differences stop here; the directory view never knows native configuration shapes. */
export const directoryProviders = (
  locale?: Locale,
): Record<
  DatastoreProvider,
  {
    label: string;
    family: string;
    targetLabel: string;
    accountLabel?: string;
    authSourceLabel?: string;
  }
> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    sqlite: { label: 'SQLite', family: 'relational', targetLabel: tConnector('file') },
    mysql: {
      label: 'MySQL',
      family: 'relational',
      targetLabel: tConnector('connectionTarget'),
      accountLabel: tConnector('loginAccount'),
    },
    postgres: {
      label: 'PostgreSQL',
      family: 'relational',
      targetLabel: tConnector('connectionTarget'),
      accountLabel: tConnector('loginAccount'),
    },
    redis: {
      label: 'Redis',
      family: 'redis',
      targetLabel: tConnector('connectionTarget'),
      accountLabel: tConnector('loginAccount'),
    },
    mongodb: {
      label: 'MongoDB',
      family: 'mongo',
      targetLabel: tConnector('connectionTarget'),
      accountLabel: tConnector('loginAccount'),
      authSourceLabel: tConnector('authenticationDatabase'),
    },
  };
};
export function connectionListRow(
  entry: SavedDatastoreConnection,
  testing: boolean,
  locale?: Locale,
): ConnectionListRow {
  const tConnector = createTranslator(connectorMessages, locale);
  const { config } = entry;
  const directory = entry.directory ?? emptyDirectory;
  const target =
    config.provider === 'sqlite'
      ? config.path.split(/[\\/]/).pop() || config.path
      : `${config.host}:${config.port}${config.provider === 'redis' ? ` / DB ${config.database}` : config.database ? ` / ${config.database}` : ''}`;
  return {
    id: entry.id,
    name: entry.name,
    target,
    targetTitle: config.provider === 'sqlite' ? config.path : target,
    account:
      config.provider === 'sqlite'
        ? undefined
        : config.provider === 'redis'
          ? config.username || 'default'
          : config.username || tConnector('notConfigured'),
    authSource: config.provider === 'mongodb' ? config.authSource : undefined,
    ...directory,
    status: testing ? 'testing' : (entry.status?.kind ?? 'untested'),
    statusTitle: entry.status
      ? tConnector('lastConnectionValidationThisDoesNotIndicateCurrentAvailability', {
          p0: String(entry.status.kind === 'passed' ? tConnector('passed') : tConnector('failed')),
          p1: String(new Date(entry.status.checkedAt).toLocaleString(locale ?? getLocale())),
        })
      : tConnector('thisConnectionHasNotBeenValidatedTestItFirst'),
  };
}
