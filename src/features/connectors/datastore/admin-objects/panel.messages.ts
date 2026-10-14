import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  sqliteHasNoMysqlEventOrPostgresqlExtensionCatalog: [
    'SQLite 没有 MySQL 事件或 PostgreSQL 扩展目录。',
    'SQLite has no MySQL event or PostgreSQL extension catalog.',
  ],
  nativeProviderSpecificObjectCatalog: [
    '原生专属对象目录',
    'Native provider-specific object catalog',
  ],
  mysqlEvents: ['MySQL 事件', 'MySQL events'],
  postgresqlExtensions: ['PostgreSQL 扩展', 'PostgreSQL extensions'],
  readOnlyCatalog: ['只读目录', 'Read-only catalog'],
  refreshProviderSpecificObjectCatalog: [
    '刷新专属对象目录',
    'Refresh provider-specific object catalog',
  ],
  searchProviderSpecificObjects: ['搜索专属对象', 'Search provider-specific objects'],
  searchEventNamesOrComments: ['搜索事件名称或注释…', 'Search event names or comments…'],
  searchExtensionNamesOrDescriptions: [
    '搜索扩展名称或说明…',
    'Search extension names or descriptions…',
  ],
  filterExtensionInstallationStatus: ['扩展安装状态筛选', 'Filter extension installation status'],
  installed: ['已安装', 'Installed'],
  availableToInstall: ['可安装', 'Available to install'],
  all: ['全部', 'All'],
  reading: ['读取中', 'Reading'],
  items: ['{p0} 项', '{p0} items'],
  readingNativeCatalog: ['读取原生目录…', 'Reading native catalog…'],
  retryCatalog: ['重试目录', 'Retry catalog'],
  event: ['事件', 'Event'],
  extension: ['扩展', 'Extension'],
  view: ['查看{p0} {p1}', 'View {p0} {p1}'],
  unknownStatus: ['状态未知', 'Unknown status'],
  unknownSchedule: ['调度未知', 'Unknown schedule'],
  unknownSchema: ['Schema 未知', 'Unknown schema'],
  installed250: ['已安装 {p0} · {p1}', 'Installed {p0} · {p1}'],
  unknownVersion: ['版本未知', 'Unknown version'],
  available: ['可安装 {p0}', 'Available {p0}'],
  noMatchingProviderSpecificObjects: [
    '没有匹配的专属对象。',
    'No matching provider-specific objects.',
  ],
  noEventsAreVisibleToTheCurrentRole: [
    '当前角色可见范围内没有事件。',
    'No events are visible to the current role.',
  ],
  noExtensionsMatchTheCurrentFilters: [
    '当前筛选没有扩展。',
    'No extensions match the current filters.',
  ],
  previousProviderSpecificObjectPage: ['上一页专属对象', 'Previous provider-specific object page'],
  nextProviderSpecificObjectPage: ['下一页专属对象', 'Next provider-specific object page'],
  readingNativeObjectDetails: ['读取原生对象详情…', 'Reading native object details…'],
  retryDetails: ['重试详情', 'Retry details'],
  selectAnObjectToReadItsNativeDetails: [
    '选择对象以读取原生详情。',
    'Select an object to read its native details.',
  ],
});
