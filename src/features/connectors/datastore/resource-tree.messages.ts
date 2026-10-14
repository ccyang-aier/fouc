import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  table: ['表', 'Table'],
  view: ['视图', 'View'],
  databaseResources: ['数据库资源', 'Database resources'],
  refreshDatabaseResources: ['刷新数据库资源', 'Refresh database resources'],
  collapseAllDatabaseResources: ['全部折叠数据库资源', 'Collapse all database resources'],
  collapseAll: ['全部折叠', 'Collapse all'],
  minimizeDatabaseResources: ['收纳数据库资源', 'Minimize database resources'],
  minimizeSidebar: ['收纳侧栏', 'Minimize sidebar'],
  searchTables: ['搜索表', 'Search tables'],
  searchTablesOrViews: ['搜索表或视图', 'Search tables or views'],
  expand: ['展开', 'Expand'],
  collapse: ['收起', 'Collapse'],
  connectionResources: ['{p0}连接资源', '{p0} connection resources'],
  connected: ['已连接', 'Connected'],
  noMatchingTablesOrViews: ['没有匹配的表或视图', 'No matching tables or views'],
  noVisibleObjectsInTheCurrentSchema: [
    '当前 Schema 没有可见对象',
    'No visible objects in the current schema',
  ],
  query: ['查询', 'Query'],
  schemas: ['个 Schema', ' schemas'],
  objects: ['个对象', ' objects'],
});
