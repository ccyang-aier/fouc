import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  totalRowsExceedTheCurrentPaginationNavigationRange: [
    '总行数超出当前分页可跳转范围',
    'Total rows exceed the current pagination navigation range',
  ],
  failedToReadTotalRowCount: ['读取总行数失败', 'Failed to read total row count'],
  enterAValidPageNumber: ['请输入有效页码', 'Enter a valid page number'],
  tableDataPaginationAndStatistics: ['表数据分页与统计', 'Table data pagination and statistics'],
  theDatabaseReturnedRowsForThisPage: [
    '当前页从数据库返回 {p0} 行',
    'The database returned {p0} rows for this page',
  ],
  total: ['共', 'Total'],
  row: ['行', ' row'],
  refreshTotalRowCount: ['刷新总行数', 'Refresh total row count'],
  readTotalRowsUnderTheCurrentDatabaseFilter: [
    '读取当前数据库筛选下的总行数',
    'Read total rows under the current database filter',
  ],
  totalRowCountNotReadYet: ['总行数尚未读取', 'Total row count not read yet'],
  rowsInTotal: ['总计 {p0} 行', '{p0} rows in total'],
  total3627: ['总计', 'Total'],
  tableDataRequestTookMsIncludingNetworkTransfer: [
    '表数据请求耗时 {p0} ms，包含网络传输',
    'Table data request took {p0} ms, including network transfer',
  ],
  firstPageData: ['首页数据', 'First page data'],
  firstPage: ['首页', 'First page'],
  previousPageData: ['上一页数据', 'Previous page data'],
  previousPage: ['上一页', 'Previous page'],
  goToDataPage: ['跳转数据页', 'Go to data page'],
  enterAPageNumberAndPressEnter: ['输入页码后按 Enter', 'Enter a page number and press Enter'],
  nextPageData: ['下一页数据', 'Next page data'],
  nextPage: ['下一页', 'Next page'],
  lastPageData: ['末页数据', 'Last page data'],
  lastPage: ['末页', 'Last page'],
  closeDataTable: ['关闭数据表', 'Close data table'],
});
