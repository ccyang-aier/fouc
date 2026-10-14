import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  couldNotApplyTheFilter: ['无法应用筛选', 'Could not apply the filter'],
  local: ['本地', 'Local'],
  database: ['数据库', 'Database'],
  valueFilterFor: ['{p0}值筛选“{p1}”', '{p0} value filter for “{p1}”'],
  chooseFromLoadedValuesOnTheCurrentPageFilteringRuns: [
    '从当前页已加载值中选择，筛选在数据库执行',
    'Choose from loaded values on the current page; filtering runs in the database',
  ],
  searchFilterValuesFor: ['搜索 {p0} 筛选值', 'Search filter values for {p0}'],
  searchValues: ['搜索值…', 'Search values…'],
  selectAllMatchingValues: ['选择全部匹配值', 'Select all matching values'],
  value: ['值', 'Value'],
  count: ['数量', 'Count'],
  filterValue: ['筛选值 {p0}', 'Filter value {p0}'],
  noMatchingValues: ['没有匹配值', 'No matching values'],
  clearFilters: ['清除筛选', 'Clear filters'],
  cancel: ['取消', 'Cancel'],
  applyFilter: ['应用筛选', 'Apply filter'],
});
