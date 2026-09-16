export type AutomationStatus = "enabled" | "running" | "attention" | "paused"

export type AutomationDefinition = {
  id: string
  title: string
  description: string
  schedule: string
  timezone: string
  agent: string
  agentInitial: string
  workspace: string
  workspaceShort: string
  lastRun: string
  lastRunDetail: string
  status: AutomationStatus
  enabled: boolean
  notification: string
  timeout: string
}

export const initialAutomations: AutomationDefinition[] = [
  { id: "AUTO-001", title: "每日工作简报", description: "整理昨日进展、当前风险与今天需要优先推进的工作。", schedule: "每天 08:30", timezone: "Asia/Shanghai (UTC+08:00)", agent: "Nova", agentInitial: "N", workspace: "产品研发", workspaceShort: "PR", lastRun: "今天 08:32", lastRunDetail: "成功", status: "enabled", enabled: true, notification: "发送给 2 位成员", timeout: "30 分钟" },
  { id: "AUTO-002", title: "项目风险巡检", description: "检查阻塞、延期信号与依赖变更，并同步风险清单。", schedule: "每 2 小时", timezone: "Asia/Shanghai (UTC+08:00)", agent: "Sage", agentInitial: "S", workspace: "产品研发", workspaceShort: "PR", lastRun: "10:24", lastRunDetail: "发现 2 个风险", status: "running", enabled: true, notification: "发现风险时通知", timeout: "20 分钟" },
  { id: "AUTO-003", title: "客户反馈聚合", description: "归类新反馈并交给对应负责人，无法解析时请求介入。", schedule: "有新反馈时", timezone: "事件触发", agent: "Nova", agentInitial: "N", workspace: "客户成功", workspaceShort: "CS", lastRun: "09:42", lastRunDetail: "1 条需处理", status: "attention", enabled: true, notification: "需要介入时通知", timeout: "15 分钟" },
  { id: "AUTO-004", title: "周五交付检查", description: "在交付前核对验收项、构建结果与发布材料。", schedule: "每周五 16:00", timezone: "Asia/Shanghai (UTC+08:00)", agent: "Sage", agentInitial: "S", workspace: "产品研发", workspaceShort: "PR", lastRun: "5 月 10 日", lastRunDetail: "成功", status: "paused", enabled: false, notification: "失败时通知", timeout: "30 分钟" },
]

export type RunRecord = {
  id: string
  automation: string
  startedAt: string
  duration: string
  result: "成功" | "运行中" | "需要处理"
  summary: string
}

export const runRecords: RunRecord[] = [
  { id: "RUN-0831", automation: "项目风险巡检", startedAt: "今天 10:24", duration: "1 分 26 秒", result: "运行中", summary: "正在核对 7 个进行中的工作项" },
  { id: "RUN-0830", automation: "客户反馈聚合", startedAt: "今天 09:42", duration: "48 秒", result: "需要处理", summary: "1 条邮件正文无法解析" },
  { id: "RUN-0829", automation: "每日工作简报", startedAt: "今天 08:30", duration: "2 分 18 秒", result: "成功", summary: "简报已发送给 2 位成员" },
  { id: "RUN-0828", automation: "项目风险巡检", startedAt: "今天 08:24", duration: "1 分 42 秒", result: "成功", summary: "未发现新的高风险项" },
]
