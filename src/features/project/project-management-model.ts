export type RailPresence = "online" | "busy" | "away" | "offline"

export type RailMember = {
  id: string
  name: string
  role: string
  avatar: string
  presence: RailPresence
  focus: string
  tasks: number
}

export type ProjectManagementPanelId =
  | "summary"
  | "chat"
  | "mentions"
  | "notifications"
  | "ai-assets"
  | "project-assets"
  | "tasks"
  | "agent"
  | "invite"
  | "settings"
  | `member:${string}`

export const presenceMeta: Record<RailPresence, { color: string; label: string }> = {
  online: { color: "#31b777", label: "在线" },
  busy: { color: "#df5660", label: "忙碌" },
  away: { color: "#e9aa32", label: "离开" },
  offline: { color: "#c8ced6", label: "离线" },
}

export const railMembers: RailMember[] = [
  { id: "lin-mo", name: "林默", role: "项目负责人", avatar: "/avatars/member-1.png", presence: "online", focus: "权限模型评审", tasks: 4 },
  { id: "zhou-xin", name: "周欣", role: "后端工程师", avatar: "/avatars/member-2.png", presence: "online", focus: "通知服务接口", tasks: 3 },
  { id: "chen-an", name: "陈安", role: "测试工程师", avatar: "/avatars/member-3.png", presence: "offline", focus: "Issue-128 回归", tasks: 2 },
  { id: "su-qing", name: "苏晴", role: "产品设计师", avatar: "/avatars/member-4.png", presence: "busy", focus: "工作台交互规范", tasks: 3 },
  { id: "li-ang", name: "李昂", role: "前端工程师", avatar: "/avatars/member-5.png", presence: "busy", focus: "项目管理面板", tasks: 5 },
  { id: "xiao-man", name: "小满", role: "产品经理", avatar: "/avatars/member-6.png", presence: "online", focus: "V1 范围确认", tasks: 4 },
  { id: "he-jing", name: "何静", role: "内容设计", avatar: "/avatars/member-7.png", presence: "away", focus: "项目规则整理", tasks: 2 },
  { id: "gao-xiang", name: "高翔", role: "平台工程师", avatar: "/avatars/member-8.png", presence: "away", focus: "构建与发布", tasks: 3 },
  { id: "han-mei", name: "韩梅", role: "安全顾问", avatar: "/avatars/member-9.png", presence: "offline", focus: "访问控制审计", tasks: 1 },
]

export function getRailMember(panelId: ProjectManagementPanelId | null) {
  if (!panelId?.startsWith("member:")) return null
  return railMembers.find((member) => member.id === panelId.slice("member:".length)) ?? null
}
