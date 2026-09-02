import {
  BookOpenText,
  BracketsCurly,
  CalendarBlank,
  Cube,
  FileCode,
  FileText,
  Lightning,
  LinkSimple,
  ShieldCheck,
} from "@phosphor-icons/react"

export const projectTabs = [
  { id: "overview", label: "总览", icon: BracketsCurly },
  { id: "work", label: "工作", icon: CalendarBlank },
  { id: "outputs", label: "产物", icon: FileText },
  { id: "resources", label: "资源", icon: Cube },
  { id: "timeline", label: "时间线", icon: CalendarBlank },
] as const

export type ProjectTab = (typeof projectTabs)[number]["id"]

export const inProgress = [
  { title: "权限模型设计文档 v1.2", meta: "文档 · 设计", date: "6月5日", progress: 70, avatar: "/avatars/lin-mo.png" },
  { title: "桌面通知中心开发", meta: "开发 · 通知系统", date: "6月12日", progress: 45, avatar: "/avatars/zhou-xin.png" },
  { title: "用户管理界面原型 v0.9", meta: "原型 · 用户中心", date: "6月15日", progress: 30, avatar: "/avatars/lin-mo.png" },
] as const

export const recentOutputs = [
  { title: "权限模型评审记录 v1.0", meta: "文档 · 审批", owner: "林默", time: "2 小时前", icon: FileText },
  { title: "通知服务接口变更说明", meta: "文档 · 技术方案", owner: "周欣", time: "5 小时前", icon: FileCode },
  { title: "Issue-128 回归测试报告", meta: "文档 · 测试报告", owner: "陈晨", time: "昨天 16:20", icon: FileText },
] as const

export const contextGroups = [
  { label: "Skills", description: "项目专属技能与知识", count: 4, icon: ShieldCheck },
  { label: "MCP 连接", description: "已连接的服务与数据源", count: 3, icon: LinkSimple },
  { label: "项目规则", description: "规范、流程与命名策略", count: 6, icon: BookOpenText },
  { label: "自动化", description: "触发器、流程与规则", count: 2, icon: Lightning },
] as const

export const freshnessItems = [
  { label: "代码仓库", description: "最后同步：2 小时前", icon: Cube },
  { label: "Issue 跟踪", description: "最后同步：15 分钟前", icon: FileCode },
  { label: "设计文档", description: "最后同步：1 小时前", icon: FileText },
] as const
