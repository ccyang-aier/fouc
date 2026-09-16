export type WorkStatus = "todo" | "doing" | "review" | "done"
export type WorkPriority = "low" | "medium" | "high"

export type WorkAssignee = {
  name: "林默" | "小满" | "陈安" | "Nova"
  avatar?: string
  handle?: string
}

export type WorkItem = {
  id: string
  title: string
  status: WorkStatus
  priority: WorkPriority
  assignee: WorkAssignee
  completed: number
  total: number
  updated: string
  blocker?: string
}

export const workStatusMeta = {
  todo: { label: "待处理", tint: "bg-[#f7f8fa]", accent: "text-[#6f7b8e]" },
  doing: { label: "进行中", tint: "bg-[#f4f7fe]", accent: "text-[#3973e8]" },
  review: { label: "待评审", tint: "bg-[#fff8f1]", accent: "text-[#ae6b32]" },
  done: { label: "已完成", tint: "bg-[#f7f8fa]", accent: "text-[#6f7b8e]" },
} satisfies Record<WorkStatus, { label: string; tint: string; accent: string }>

export const initialWorkItems: WorkItem[] = [
  { id: "ISSUE-130", title: "优化启动性能（冷启动 < 2s）", status: "todo", priority: "medium", assignee: { name: "林默", avatar: "/avatars/lin-mo.png" }, completed: 0, total: 5, updated: "更新于 2 天前" },
  { id: "FEATURE-134", title: "支持多主题色切换", status: "todo", priority: "low", assignee: { name: "陈安" }, completed: 0, total: 4, updated: "更新于 3 天前" },
  { id: "TASK-141", title: "补充桌面端使用文档", status: "todo", priority: "low", assignee: { name: "小满" }, completed: 0, total: 3, updated: "更新于 3 天前" },
  { id: "ISSUE-128", title: "修复测试环境登录失败", status: "doing", priority: "high", assignee: { name: "林默", avatar: "/avatars/lin-mo.png", handle: "@linmo" }, completed: 3, total: 5, updated: "更新于 1 小时前", blocker: "未合并的配置变更" },
  { id: "FEATURE-126", title: "实现 Work Room 结果抽屉", status: "doing", priority: "high", assignee: { name: "Nova" }, completed: 2, total: 4, updated: "更新于 3 小时前" },
  { id: "TASK-132", title: "设计项目权限模型", status: "doing", priority: "medium", assignee: { name: "陈安" }, completed: 1, total: 4, updated: "更新于 5 小时前" },
  { id: "FEATURE-123", title: "支持工作批量移动", status: "review", priority: "medium", assignee: { name: "小满" }, completed: 3, total: 4, updated: "更新于 4 小时前" },
  { id: "BUG-127", title: "修复 Markdown 预览异常", status: "review", priority: "high", assignee: { name: "林默", avatar: "/avatars/lin-mo.png" }, completed: 2, total: 3, updated: "更新于 6 小时前" },
  { id: "FEATURE-120", title: "项目概览数据看板", status: "done", priority: "medium", assignee: { name: "林默", avatar: "/avatars/lin-mo.png" }, completed: 5, total: 5, updated: "完成于 1 天前" },
  { id: "TASK-121", title: "左侧导航交互优化", status: "done", priority: "low", assignee: { name: "小满" }, completed: 4, total: 4, updated: "完成于 2 天前" },
  { id: "BUG-122", title: "修复列表视图分页问题", status: "done", priority: "medium", assignee: { name: "林默", avatar: "/avatars/lin-mo.png" }, completed: 3, total: 3, updated: "完成于 2 天前" },
]

export const issueChecklist = [
  "复现测试环境登录失败",
  "定位根因",
  "修复并自测通过",
  "补充单元测试",
  "回归测试通过",
] as const
