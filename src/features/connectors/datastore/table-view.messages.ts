import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  exportCurrentPageData: ['导出当前页数据', 'Export current page data'],
  export: ['导出', 'Export'],
  currentPageShows: ['当前页显示 ', 'Current page shows '],
  loaded: [' / 已加载 ', ' / loaded '],
  rowsSearchHighlights: [' 行 · 搜索高亮', ' rows · search highlights'],
  currentPageMatches: ['当前页匹配 ', 'Current page matches '],
  rows: [' 行', ' rows'],
  currentPageLoaded: ['当前页已加载 ', 'Current page loaded '],
  noMatchingRecordsOnThisPage: ['当前页没有匹配记录', 'No matching records on this page'],
  noRecordsMatchTheDatabaseFilter: [
    '没有符合数据库筛选的记录',
    'No records match the database filter',
  ],
  theTableHasNoRecords: ['表中没有记录', 'The table has no records'],
});
