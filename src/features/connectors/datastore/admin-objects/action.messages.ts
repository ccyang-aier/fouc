import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  mysqlEventCatalog: ['MySQL 事件目录', 'MySQL event catalog'],
  postgresqlExtensionCatalog: ['PostgreSQL 扩展目录', 'PostgreSQL extension catalog'],
  open: ['打开{p0}', 'Open {p0}'],
  event: ['事件', 'Event'],
  extension: ['扩展', 'Extension'],
  currentConnectionReadOnlyNativeCatalog: [
    '当前连接 · 只读原生目录',
    'Current connection · Read-only native catalog',
  ],
  close: ['关闭', 'Close'],
});
