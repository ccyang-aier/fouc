import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  viewResultSourceDdl: ['查看结果来源 DDL', 'View result source DDL'],
  viewDdlFor: ['查看 {p0}.{p1} 的 DDL', 'View DDL for {p0}.{p1}'],
  theCurrentResultSourceCannotBeUniquelyDetermined: [
    '当前结果的来源无法唯一确定',
    'The current result source cannot be uniquely determined',
  ],
  readingObjectDdl: ['正在读取对象 DDL…', 'Reading object DDL…'],
  retry: ['重试', 'Retry'],
  originalDatabaseDdl: ['数据库原始 DDL', 'Original database DDL'],
  ddlReconstructedFromTheDatabaseCatalog: [
    '根据数据库目录重建的 DDL',
    'DDL reconstructed from the database catalog',
  ],
  objectDdlSource: ['对象 DDL 源码', 'Object DDL source'],
  readOnlyView: ['只读查看', 'Read-only view'],
  ddlCopied: ['已复制 DDL', 'DDL copied'],
  copyFailedCheckClipboardPermissions: [
    '复制失败，请检查剪贴板权限',
    'Copy failed. Check clipboard permissions',
  ],
  copyDdl: ['复制 DDL', 'Copy DDL'],
});
