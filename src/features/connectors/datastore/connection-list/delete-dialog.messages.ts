import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  deleteConnection: ['删除连接', 'Delete connection'],
  deleteConnections: ['删除 {p0} 个连接', 'Delete {p0} connections'],
  onlyConnectionConfigurationsAreDeletedDatabasesAndTheirContentsAre: [
    '仅删除连接配置，数据库及其内容不受影响。',
    'Only connection configurations are deleted. Databases and their contents are unaffected.',
  ],
  cancel: ['取消', 'Cancel'],
  deleting: ['删除中…', 'Deleting…'],
  confirmDeletion: ['确认删除', 'Confirm deletion'],
});
