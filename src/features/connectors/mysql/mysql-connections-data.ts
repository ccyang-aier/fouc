export type MysqlConnectionEnvironment = "生产" | "分析" | "预发布" | "开发" | "其他"
export type MysqlConnectionStatus = "healthy" | "auth-required" | "offline"
export type MysqlConnectionProject = "Fouc 桌面端 V1" | "数据平台" | "个人工作台"

export type MysqlConnection = {
  id: string
  name: string
  description: string
  project: MysqlConnectionProject
  environment: MysqlConnectionEnvironment
  host: string
  database: string
  username: string
  status: MysqlConnectionStatus
  lastUsed: string
  lastUsedOrder: number
  favorite: boolean
  liveSessionId?: string
}

export const MYSQL_ENVIRONMENTS: ReadonlyArray<"全部环境" | MysqlConnectionEnvironment> = [
  "全部环境",
  "生产",
  "分析",
  "预发布",
  "开发",
  "其他",
]

export const MYSQL_STATUSES: ReadonlyArray<{ value: "all" | MysqlConnectionStatus; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "healthy", label: "正常" },
  { value: "auth-required", label: "需认证" },
  { value: "offline", label: "离线" },
]

export const MYSQL_PROJECTS: ReadonlyArray<"全部项目" | MysqlConnectionProject> = [
  "全部项目",
  "Fouc 桌面端 V1",
  "数据平台",
  "个人工作台",
]

export const initialMysqlConnections: MysqlConnection[] = [
  {
    id: "mysql-production-orders",
    name: "生产订单库",
    description: "核心业务",
    project: "Fouc 桌面端 V1",
    environment: "生产",
    host: "mysql-prod.internal:3306",
    database: "orders",
    username: "orders_app",
    status: "healthy",
    lastUsed: "今天 14:30",
    lastUsedOrder: 0,
    favorite: true,
  },
  {
    id: "mysql-analytics",
    name: "数据分析库",
    description: "BI / 报表",
    project: "数据平台",
    environment: "分析",
    host: "10.24.8.16:3306",
    database: "analytics",
    username: "bi_reader",
    status: "healthy",
    lastUsed: "今天 11:20",
    lastUsedOrder: 1,
    favorite: false,
  },
  {
    id: "mysql-staging",
    name: "预发布验证库",
    description: "测试环境",
    project: "Fouc 桌面端 V1",
    environment: "预发布",
    host: "10.24.8.32:3306",
    database: "test",
    username: "qa_runner",
    status: "auth-required",
    lastUsed: "昨天 18:45",
    lastUsedOrder: 2,
    favorite: true,
  },
  {
    id: "mysql-local",
    name: "本地开发库",
    description: "个人",
    project: "个人工作台",
    environment: "开发",
    host: "127.0.0.1:3306",
    database: "dev",
    username: "root",
    status: "healthy",
    lastUsed: "昨天 10:12",
    lastUsedOrder: 3,
    favorite: false,
  },
  {
    id: "mysql-customer-mirror",
    name: "客户镜像库",
    description: "客户数据",
    project: "数据平台",
    environment: "其他",
    host: "192.168.1.88:3306",
    database: "customer",
    username: "mirror_ro",
    status: "offline",
    lastUsed: "2025-03-08 16:20",
    lastUsedOrder: 4,
    favorite: false,
  },
]

export const mysqlEnvironmentTone: Record<MysqlConnectionEnvironment, string> = {
  生产: "#e44f59",
  分析: "#805ad5",
  预发布: "#2e86de",
  开发: "#2eaf72",
  其他: "#7b8494",
}

export const mysqlStatusMeta: Record<MysqlConnectionStatus, { label: string; tone: string }> = {
  healthy: { label: "正常", tone: "success" },
  "auth-required": { label: "需认证", tone: "warning" },
  offline: { label: "离线", tone: "error" },
}
