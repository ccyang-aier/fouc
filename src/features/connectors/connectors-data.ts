/**
 * 连接器目录：系统内置的外部服务与数据源接入能力，不经社区分发。
 * V1 为本地演示数据，后续由连接器服务接入替换。
 */
import { createTranslator, getLocale, type Locale } from '@/lib/i18n';
import { messages } from './connectors-data.messages';

export type ConnectorCategory = '研发协作' | '办公协同' | '数据源' | '设计资产';

export type Connector = {
  id: string;
  name: string;
  logo: string;
  category: ConnectorCategory;
  description: string;
  version: string;
  updated: string;
  updatedDays: number;
  connected: boolean;
};

export const CONNECTOR_CATEGORIES: ReadonlyArray<'全部' | ConnectorCategory> = [
  '全部',
  '研发协作',
  '办公协同',
  '数据源',
  '设计资产',
];

export const initialConnectors: Connector[] = [
  {
    id: 'connector-dts',
    name: 'DTS',
    logo: '/connector-logos/dts.svg',
    category: '研发协作',
    description: '通过当前设备安全读取工单、流程、关联关系与权限信息。',
    version: '1.0.0',
    updated: '刚刚',
    updatedDays: 0,
    connected: false,
  },
  {
    id: 'connector-github',
    name: 'GitHub',
    logo: '/connector-logos/github.svg',
    category: '研发协作',
    description: '同步仓库、Issue 与 PR 状态到任务流，提交即更新进度。',
    version: '4.3.0',
    updated: '1 天前',
    updatedDays: 1,
    connected: true,
  },
  {
    id: 'connector-gitlab',
    name: 'GitLab',
    logo: '/connector-logos/gitlab.svg',
    category: '研发协作',
    description: '接入 GitLab 仓库与流水线状态，MR 联动任务评审。',
    version: '3.1.2',
    updated: '3 天前',
    updatedDays: 3,
    connected: false,
  },
  {
    id: 'connector-sentry',
    name: 'Sentry',
    logo: '/connector-logos/sentry.svg',
    category: '研发协作',
    description: '引入错误与性能事件，异常自动建单并关联版本。',
    version: '2.4.0',
    updated: '4 天前',
    updatedDays: 4,
    connected: false,
  },
  {
    id: 'connector-jira',
    name: 'Jira',
    logo: '/connector-logos/jira.svg',
    category: '研发协作',
    description: '导入看板与缺陷单，状态变更联动任务与里程碑。',
    version: '5.2.1',
    updated: '1 周前',
    updatedDays: 7,
    connected: false,
  },
  {
    id: 'connector-feishu',
    name: '飞书',
    logo: '/connector-logos/feishu.png',
    category: '办公协同',
    description: '群消息、云文档与日历事件接入工作台，@机器人即可派活。',
    version: '6.0.3',
    updated: '2 天前',
    updatedDays: 2,
    connected: true,
  },
  {
    id: 'connector-dingtalk',
    name: '钉钉',
    logo: '/connector-logos/dingtalk.png',
    category: '办公协同',
    description: '审批与考勤事件驱动的自动化，结果回传群卡片。',
    version: '3.8.0',
    updated: '5 天前',
    updatedDays: 5,
    connected: false,
  },
  {
    id: 'connector-wecom',
    name: '企业微信',
    logo: '/connector-logos/wecom.png',
    category: '办公协同',
    description: '客户群与内部应用消息互通，外部协作进工作台。',
    version: '2.9.1',
    updated: '1 周前',
    updatedDays: 7,
    connected: false,
  },
  {
    id: 'connector-notion',
    name: 'Notion',
    logo: '/connector-logos/notion.svg',
    category: '办公协同',
    description: '双向同步数据库与文档页面，作为长期知识上下文引用。',
    version: '4.1.0',
    updated: '3 天前',
    updatedDays: 3,
    connected: false,
  },
  {
    id: 'connector-gdrive',
    name: 'Google Drive',
    logo: '/connector-logos/google-drive.svg',
    category: '办公协同',
    description: '检索并引用云端文档附件，变更时刷新任务上下文。',
    version: '3.5.2',
    updated: '6 天前',
    updatedDays: 6,
    connected: false,
  },
  {
    id: 'connector-shimo',
    name: '石墨文档',
    logo: '/connector-logos/shimo.png',
    category: '办公协同',
    description: '文档与表格轻量接入，评论与 @ 事件可驱动任务。',
    version: '1.9.0',
    updated: '2 周前',
    updatedDays: 14,
    connected: false,
  },
  {
    id: 'connector-postgres',
    name: 'PostgreSQL',
    logo: '/connector-logos/postgresql.svg',
    category: '数据源',
    description: '管理 PostgreSQL 连接，浏览 Schema、表结构与数据，执行只读 SQL。',
    version: '0.1.0',
    updated: '刚刚',
    updatedDays: 0,
    connected: false,
  },
  {
    id: 'connector-sqlite',
    name: 'SQLite',
    logo: '/connector-logos/sqlite.svg',
    category: '数据源',
    description: '打开当前设备上的 SQLite 文件，浏览结构与数据，执行只读查询。',
    version: '0.1.0',
    updated: '刚刚',
    updatedDays: 0,
    connected: false,
  },
  {
    id: 'connector-redis',
    name: 'Redis',
    logo: '/connector-logos/redis.svg',
    category: '数据源',
    description: '管理 Redis 连接，扫描 Key，查看类型、TTL 与集合，使用只读命令台。',
    version: '0.1.0',
    updated: '刚刚',
    updatedDays: 0,
    connected: false,
  },
  {
    id: 'connector-mysql',
    name: 'MySQL',
    logo: '/connector-logos/mysql.svg',
    category: '数据源',
    description: '管理 MySQL 连接，浏览数据库、表结构与数据，执行只读 SQL。',
    version: '0.1.0',
    updated: '刚刚',
    updatedDays: 0,
    connected: false,
  },
  {
    id: 'connector-mongodb',
    name: 'MongoDB',
    logo: '/connector-logos/mongodb.svg',
    category: '数据源',
    description: '浏览原生 BSON 文档、索引与集合统计，使用 Extended JSON 筛选及只读命令。',
    version: '0.1.0',
    updated: '刚刚',
    updatedDays: 0,
    connected: false,
  },
  {
    id: 'connector-figma',
    name: 'Figma',
    logo: '/connector-logos/figma.svg',
    category: '设计资产',
    description: '把设计稿版本与标注挂接到工作对象，改动自动提醒。',
    version: '3.3.4',
    updated: '3 天前',
    updatedDays: 3,
    connected: false,
  },
  {
    id: 'connector-jsdesign',
    name: '即时设计',
    logo: '/connector-logos/jsdesign.png',
    category: '设计资产',
    description: '国产设计工具文件接入，标注与切图直连任务。',
    version: '2.0.1',
    updated: '5 天前',
    updatedDays: 5,
    connected: false,
  },
];

const descriptionKeys = {
  'connector-dts': 'securelyReadTicketsWorkflowsRelationshipsAndPermissionsThroughTheCurre',
  'connector-github': 'syncRepositoriesIssuesAndPullRequestsWithTasksCommitsUpdate',
  'connector-gitlab': 'connectGitlabRepositoriesAndPipelinesLinkMergeRequestsToTask',
  'connector-sentry': 'bringInErrorAndPerformanceEventsCreateTicketsForIncidents',
  'connector-jira': 'importBoardsAndIssuesLinkStatusChangesToTasksAnd',
  'connector-feishu': 'connectGroupMessagesDocumentsAndCalendarEventsMentionTheBot',
  'connector-dingtalk': 'triggerAutomationsFromApprovalAndAttendanceEventsPostResultsBack',
  'connector-wecom': 'connectCustomerGroupsAndInternalAppMessagesForExternalCollaboration',
  'connector-notion': 'syncDatabasesAndDocumentsInBothDirectionsAsPersistentKnowledge',
  'connector-gdrive': 'findAndReferenceCloudDocumentsAndAttachmentsRefreshTaskContext',
  'connector-shimo': 'connectDocumentsAndSpreadsheetsTriggerTasksFromCommentsAndMentions',
  'connector-postgres': 'managePostgresqlConnectionsBrowseSchemasTablesAndDataAndRun',
  'connector-sqlite': 'openSqliteFilesOnTheCurrentDeviceBrowseStructureAnd',
  'connector-redis': 'manageRedisConnectionsScanKeysInspectTypesTtlsAndCollections',
  'connector-mysql': 'manageMysqlConnectionsBrowseDatabasesTablesAndDataAndRun',
  'connector-mongodb': 'browseNativeBsonDocumentsIndexesAndCollectionStatisticsWithExtended',
  'connector-figma': 'attachDesignVersionsAndAnnotationsToWorkItemsReceiveUpdates',
  'connector-jsdesign': 'connectDesignFilesAnnotationsAndExportedAssetsDirectlyToTasks',
} satisfies Record<string, keyof typeof messages>;

const categoryKeys = {
  全部: 'all',
  研发协作: 'development',
  办公协同: 'collaboration',
  数据源: 'dataSources',
  设计资产: 'designAssets',
} as const;

export function connectorCategoryLabel(category: ConnectorCategory | '全部', locale?: Locale) {
  return createTranslator(messages, locale)(categoryKeys[category]);
}

/** Present built-in catalog copy without changing resource IDs or stored connector state. */
export function connectorPresentation(
  connector: Connector,
  locale: Locale = getLocale(),
): Connector {
  const t = createTranslator(messages, locale);
  const names = {
    'connector-feishu': 'feishu',
    'connector-dingtalk': 'dingtalk',
    'connector-wecom': 'wecom',
    'connector-shimo': 'shimo',
    'connector-jsdesign': 'jsdesign',
  } as const;
  const descriptionKey = descriptionKeys[connector.id as keyof typeof descriptionKeys];
  const nameKey = names[connector.id as keyof typeof names];
  const weeks = connector.updatedDays >= 7 && connector.updatedDays % 7 === 0;
  const updated =
    connector.updatedDays === 0
      ? t('justNow')
      : new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(
          -(weeks ? connector.updatedDays / 7 : connector.updatedDays),
          weeks ? 'week' : 'day',
        );
  return {
    ...connector,
    name: nameKey ? t(nameKey) : connector.name,
    description: descriptionKey ? t(descriptionKey) : connector.description,
    updated,
  };
}
