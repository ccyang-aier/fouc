import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  viewDatabaseUsersAndRoles: ['查看数据库用户与角色', 'View database users and roles'],
  usersAndRoles: ['用户与角色', 'Users and roles'],
  nativeCatalogSnapshotDownloaded: ['原生目录快照已下载。', 'Native catalog snapshot downloaded.'],
  databaseUsersAndRoles: ['数据库用户与角色', 'Database users and roles'],
  accountAndAccessCatalog: ['账户与访问目录', 'Account and access catalog'],
  readOnly: ['· 只读', '· Read-only'],
  refreshDatabaseUserCatalog: ['刷新数据库用户目录', 'Refresh database user catalog'],
  refresh: ['刷新', 'Refresh'],
  currentRole: ['当前角色', 'Current role'],
  unknown: ['未知', 'Unknown'],
  authenticated: ['已认证', 'Authenticated'],
  onlyTheCurrentAccountIsVisible: ['仅当前账户可见', 'Only the current account is visible'],
  nativeAccountCatalog: ['原生账户目录', 'Native account catalog'],
  items: ['项', ' items'],
  accountCatalog: ['账户目录', 'Account catalog'],
  searchDatabaseAccounts: ['搜索数据库账户', 'Search database accounts'],
  accountHostOrAuthenticationMethod: [
    '账户、Host 或认证方式…',
    'Account, host, or authentication method…',
  ],
  readingTheCurrentConnectionCatalog: [
    '正在读取当前连接目录…',
    'Reading the current connection catalog…',
  ],
  anonymousAccount: ['匿名账户', 'Anonymous account'],
  locked: ['锁定', 'Locked'],
  noMatchingVisibleAccounts: ['没有匹配的可见账户。', 'No matching visible accounts.'],
  selectAnAccountToViewPublicAttributesRoleRelationshipsAnd: [
    '选择账户查看公开属性、角色关系和可见授权。',
    'Select an account to view public attributes, role relationships, and visible grants.',
  ],
  catalogSourceAndPermissionScope: ['目录来源与权限范围', 'Catalog source and permission scope'],
  itemsWereNotFullyRead: [' · {p0} 项未完整读取', ' · {p0} items were not fully read'],
  nativeScopeVisibleToTheCurrentConnection: [
    '当前连接原生可见范围',
    'Native scope visible to the current connection',
  ],
  downloadCatalogSnapshot: ['下载目录快照', 'Download catalog snapshot'],
  close: ['关闭', 'Close'],
});
