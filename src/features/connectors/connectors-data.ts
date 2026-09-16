/**
 * 连接器目录：系统内置的外部服务与数据源接入能力，不经社区分发。
 * V1 为本地演示数据，后续由连接器服务接入替换。
 */

export type ConnectorCategory = "研发协作" | "办公协同" | "数据源" | "设计资产"

export type Connector = {
  id: string
  name: string
  logo: string
  category: ConnectorCategory
  description: string
  version: string
  updated: string
  updatedDays: number
  connected: boolean
}

export const CONNECTOR_CATEGORIES: ReadonlyArray<"全部" | ConnectorCategory> = ["全部", "研发协作", "办公协同", "数据源", "设计资产"]

export const initialConnectors: Connector[] = [
  { id: "connector-github", name: "GitHub", logo: "/connector-logos/github.svg", category: "研发协作", description: "同步仓库、Issue 与 PR 状态到任务流，提交即更新进度。", version: "4.3.0", updated: "1 天前", updatedDays: 1, connected: true },
  { id: "connector-gitlab", name: "GitLab", logo: "/connector-logos/gitlab.svg", category: "研发协作", description: "接入 GitLab 仓库与流水线状态，MR 联动任务评审。", version: "3.1.2", updated: "3 天前", updatedDays: 3, connected: false },
  { id: "connector-sentry", name: "Sentry", logo: "/connector-logos/sentry.svg", category: "研发协作", description: "引入错误与性能事件，异常自动建单并关联版本。", version: "2.4.0", updated: "4 天前", updatedDays: 4, connected: false },
  { id: "connector-jira", name: "Jira", logo: "/connector-logos/jira.svg", category: "研发协作", description: "导入看板与缺陷单，状态变更联动任务与里程碑。", version: "5.2.1", updated: "1 周前", updatedDays: 7, connected: false },
  { id: "connector-feishu", name: "飞书", logo: "/connector-logos/feishu.png", category: "办公协同", description: "群消息、云文档与日历事件接入工作台，@机器人即可派活。", version: "6.0.3", updated: "2 天前", updatedDays: 2, connected: true },
  { id: "connector-dingtalk", name: "钉钉", logo: "/connector-logos/dingtalk.png", category: "办公协同", description: "审批与考勤事件驱动的自动化，结果回传群卡片。", version: "3.8.0", updated: "5 天前", updatedDays: 5, connected: false },
  { id: "connector-wecom", name: "企业微信", logo: "/connector-logos/wecom.png", category: "办公协同", description: "客户群与内部应用消息互通，外部协作进工作台。", version: "2.9.1", updated: "1 周前", updatedDays: 7, connected: false },
  { id: "connector-notion", name: "Notion", logo: "/connector-logos/notion.svg", category: "办公协同", description: "双向同步数据库与文档页面，作为长期知识上下文引用。", version: "4.1.0", updated: "3 天前", updatedDays: 3, connected: false },
  { id: "connector-gdrive", name: "Google Drive", logo: "/connector-logos/google-drive.svg", category: "办公协同", description: "检索并引用云端文档附件，变更时刷新任务上下文。", version: "3.5.2", updated: "6 天前", updatedDays: 6, connected: false },
  { id: "connector-shimo", name: "石墨文档", logo: "/connector-logos/shimo.png", category: "办公协同", description: "文档与表格轻量接入，评论与 @ 事件可驱动任务。", version: "1.9.0", updated: "2 周前", updatedDays: 14, connected: false },
  { id: "connector-postgres", name: "PostgreSQL", logo: "/connector-logos/postgresql.svg", category: "数据源", description: "只读连接查询业务库，分析结果可物化回写指定 schema。", version: "5.1.0", updated: "2 天前", updatedDays: 2, connected: false },
  { id: "connector-mysql", name: "MySQL", logo: "/connector-logos/mysql.svg", category: "数据源", description: "安全连接 MySQL 实例，慢查询与表结构随时可查。", version: "4.7.2", updated: "1 周前", updatedDays: 7, connected: false },
  { id: "connector-figma", name: "Figma", logo: "/connector-logos/figma.svg", category: "设计资产", description: "把设计稿版本与标注挂接到工作对象，改动自动提醒。", version: "3.3.4", updated: "3 天前", updatedDays: 3, connected: false },
  { id: "connector-jsdesign", name: "即时设计", logo: "/connector-logos/jsdesign.png", category: "设计资产", description: "国产设计工具文件接入，标注与切图直连任务。", version: "2.0.1", updated: "5 天前", updatedDays: 5, connected: false },
]
