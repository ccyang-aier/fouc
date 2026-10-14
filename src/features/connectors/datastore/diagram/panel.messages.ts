import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  databaseRelationshipDiagram: ['数据库关系图', 'Database relationship diagram'],
  copied: ['已复制', 'Copied'],
  copyFailedCheckBrowserClipboardPermissions: [
    '复制失败，请检查浏览器剪贴板权限',
    'Copy failed. Check browser clipboard permissions',
  ],
  structureRefreshCompleted: ['结构刷新已完成', 'Structure refresh completed'],
  structureRefreshRequested: ['已请求刷新结构', 'Structure refresh requested'],
  jsonExceedsMibReduceTheObjectScope: [
    'JSON 超过 16 MiB，请缩小对象范围',
    'JSON exceeds 16 MiB. Reduce the object scope',
  ],
  exported: ['已导出 {p0}', 'Exported {p0}'],
  automaticLayoutRestored: ['已恢复自动布局', 'Automatic layout restored'],
  readingTableStructureAndForeignKeys: [
    '正在读取表结构与外键…',
    'Reading table structure and foreign keys…',
  ],
  noObjects: ['暂无对象', 'No objects'],
  selectASchemaContainingTablesToInspectDeclaredRelationships: [
    '选择包含表的 Schema，查看已声明的关系。',
    'Select a schema containing tables to inspect declared relationships.',
  ],
  diagramObjectList: ['关系图对象清单', 'Diagram object list'],
  objects: ['对象', 'Objects'],
  notLoaded: [' · 未加载', ' · Not loaded'],
  view: [' · 视图', ' · View'],
  materializedView: [' · 物化视图', ' · Materialized view'],
  columnCount: ['字段数量', 'Column count'],
  noMatchingObjects: ['没有匹配的对象。', 'No matching objects.'],
});
