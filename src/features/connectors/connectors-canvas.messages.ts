import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  defaultOrder: ['默认排序', 'Default order'],
  recentlyUpdated: ['最近更新', 'Recently updated'],
  sortByName: ['名称排序', 'Sort by name'],
  isConnectedAndAvailableToTasksAndAutomations: [
    '{p0} 已连接，可在任务与自动化中引用',
    '{p0} is connected and available to tasks and automations',
  ],
  disconnected: ['{p0} 已断开', '{p0} disconnected'],
  disconnectingDtsClearsTheLocalConnectionSessionAndDedicatedLogin: [
    '断开 DTS 后会清除本机连接会话与专用登录 Profile。确定继续吗？',
    'Disconnecting DTS clears the local connection session and dedicated login profile. Continue?',
  ],
  dtsDisconnectedAndSessionCredentialsCleared: [
    'DTS 已断开，会话凭证已清除',
    'DTS disconnected and session credentials cleared',
  ],
  dtsDisconnectedButTheLoginProfileCouldNotBeCleared: [
    'DTS 已断开；登录 Profile 清理失败，请重启 Fouc 后重试',
    'DTS disconnected, but the login profile could not be cleared. Restart Fouc and try again',
  ],
  couldNotDisconnectDts: ['DTS 断开失败', 'Could not disconnect DTS'],
  allTypes: ['全部类型', 'All types'],
  allConnectors: ['全部连接器', 'All connectors'],
  connectors: ['连接器', 'Connectors'],
  breadcrumb: ['面包屑', 'Breadcrumb'],
  connected: ['已连接', 'Connected'],
  connectors22: ['个连接器', ' connectors'],
  searchConnectors: ['搜索连接器', 'Search connectors'],
  noMatchingConnectors: ['没有匹配的连接器', 'No matching connectors'],
  all: ['全部', 'All'],
  clearFilters: ['清除筛选条件', 'Clear filters'],
  name: ['名称', 'Name'],
  category: ['分类', 'Category'],
  description: ['描述', 'Description'],
  version: ['版本', 'Version'],
  lastUpdated: ['更新时间', 'Last updated'],
  actions: ['操作', 'Actions'],
});
