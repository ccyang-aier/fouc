/**
 * 社区目录展示数据：Agents / 连接器 / Skills 三个子页的条目。
 * 与自动化画布一致采用本地数据（V1 规划内容），后续由社区服务接入替换。
 */

import type { IconTone } from "../icon-tones"

export type CommunityTab = "agents" | "connectors" | "skills"

export type CommunityAgent = {
  id: string
  name: string
  glyph: string
  tone: IconTone
  category: "研发" | "办公" | "数据" | "内容"
  tagline: string
  tags: string[]
  author: string
  rating: number
  installs: number
  installed: boolean
}

export type CommunityConnector = {
  id: string
  name: string
  glyph: string
  tone: IconTone
  category: "研发协作" | "办公协同" | "数据源" | "设计资产"
  description: string
  publisher: string
  connected: boolean
}

export type CommunitySkill = {
  id: string
  name: string
  version: string
  tone: IconTone
  category: "研发" | "办公" | "数据"
  summary: string
  author: string
  compat: string[]
  installs: number
  installed: boolean
}

export const initialCommunityAgents: CommunityAgent[] = [
  { id: "agent-reviewer", name: "代码审查官", glyph: "审", tone: "blue", category: "研发", tagline: "按团队规范评审变更，标记风险点并给出可执行的修改建议。",
  tags: ["研发", "评审"], author: "Lint Guild", rating: 4.9, installs: 21300, installed: false },
  { id: "agent-minutes", name: "会议速记员", glyph: "会", tone: "teal", category: "办公", tagline: "从录音与屏幕共享中提炼决议、待办与时间线，同步到任务。",
  tags: ["办公", "纪要"], author: "Fouc 官方", rating: 4.8, installs: 15200, installed: true },
  { id: "agent-translator", name: "翻译本地化", glyph: "译", tone: "sky", category: "内容", tagline: "面向产品文案的多语言本地化，自动保持术语与语气一致。",
  tags: ["翻译", "全球化"], author: "Fouc 官方", rating: 4.9, installs: 11700, installed: false },
  { id: "agent-competitor", name: "竞品雷达", glyph: "竞", tone: "violet", category: "内容", tagline: "持续追踪竞品版本与定价动态，产出周度对比简报。",
  tags: ["调研", "简报"], author: "星野工作坊", rating: 4.8, installs: 9600, installed: false },
  { id: "agent-testgen", name: "测试生成器", glyph: "测", tone: "rose", category: "研发", tagline: "依据变更差异生成单元测试与边界用例，直出可运行脚手架。",
  tags: ["研发", "测试"], author: "QA Circle", rating: 4.7, installs: 8900, installed: false },
  { id: "agent-writer", name: "文档作家", glyph: "文", tone: "amber", category: "内容", tagline: "把粗糙要点扩写为结构清晰的产品文档与发布说明。",
  tags: ["写作", "文档"], author: "墨迹工作室", rating: 4.7, installs: 7100, installed: false },
  { id: "agent-backfill", name: "数据补全师", glyph: "数", tone: "indigo", category: "数据", tagline: "识别表格缺失字段，从公开源安全补全并标注置信度。",
  tags: ["数据", "清洗"], author: "DataCraft", rating: 4.6, installs: 5400, installed: false },
  { id: "agent-interviewer", name: "面试教练", glyph: "面", tone: "violet", category: "办公", tagline: "基于岗位 JD 模拟技术面试，逐题给出评分与改进建议。",
  tags: ["招聘", "模拟"], author: "Offer 更多", rating: 4.5, installs: 3200, installed: false },
]

export const initialCommunityConnectors: CommunityConnector[] = [
  { id: "connector-github", name: "GitHub", glyph: "GH", tone: "slate", category: "研发协作", description: "同步仓库、Issue 与 PR 状态到任务流，提交即更新进度。", publisher: "GitHub, Inc.", connected: true },
  { id: "connector-feishu", name: "飞书", glyph: "飞", tone: "sky", category: "办公协同", description: "群消息、云文档与日历事件接入工作台，@机器人即可派活。", publisher: "字节跳动", connected: true },
  { id: "connector-postgres", name: "PostgreSQL", glyph: "PG", tone: "indigo", category: "数据源", description: "只读连接查询业务库，分析结果可物化回写指定 schema。", publisher: "社区维护", connected: false },
  { id: "connector-figma", name: "Figma", glyph: "Fi", tone: "rose", category: "设计资产", description: "把设计稿版本与标注挂接到工作对象，改动自动提醒。", publisher: "Figma, Inc.", connected: false },
  { id: "connector-notion", name: "Notion", glyph: "No", tone: "slate", category: "办公协同", description: "双向同步数据库与文档页面，作为长期知识上下文引用。", publisher: "Notion Labs", connected: false },
  { id: "connector-jira", name: "Jira", glyph: "Ji", tone: "blue", category: "研发协作", description: "导入看板与缺陷单，状态变更联动任务与里程碑。", publisher: "Atlassian", connected: false },
  { id: "connector-gdrive", name: "Google Drive", glyph: "GD", tone: "amber", category: "办公协同", description: "检索并引用云端文档附件，变更时刷新任务上下文。", publisher: "Google", connected: false },
  { id: "connector-dingtalk", name: "钉钉", glyph: "钉", tone: "sky", category: "办公协同", description: "审批与考勤事件驱动的自动化，结果回传群卡片。", publisher: "钉钉", connected: false },
]

export const initialCommunitySkills: CommunitySkill[] = [
  { id: "skill-sql", name: "SQL 查询生成", version: "2.3", tone: "indigo", category: "数据", summary: "从自然语言问题生成可审查的 SQL 与执行计划，附表结构说明。", author: "DataCraft", compat: ["Nova", "Sage"], installs: 18200, installed: true },
  { id: "skill-review", name: "评审清单", version: "3.0", tone: "blue", category: "研发", summary: "按团队规范生成变更评审 checklist，覆盖安全与性能基线。", author: "Lint Guild", compat: ["Codey"], installs: 12600, installed: false },
  { id: "skill-slides", name: "PPT 大纲师", version: "2.0", tone: "amber", category: "办公", summary: "从主题到逐页大纲与讲者备注，支持品牌模板约束。", author: "墨迹工作室", compat: ["Nova", "Sage"], installs: 14100, installed: false },
  { id: "skill-weekly", name: "周报编排", version: "1.8", tone: "teal", category: "办公", summary: "汇总任务进度与运行记录，产出结构化周报草稿。", author: "Fouc 官方", compat: ["Nova"], installs: 9400, installed: false },
  { id: "skill-api", name: "API 文档速读", version: "1.5", tone: "sky", category: "研发", summary: "抽取端点、鉴权与限流要点，生成一页速查卡。", author: "星野工作坊", compat: ["Codey", "Sage"], installs: 7700, installed: false },
  { id: "skill-competitor", name: "竞品分析框架", version: "1.2", tone: "violet", category: "数据", summary: "定位、定价与功能矩阵的标准化拆解，输出对比结论。", author: "星野工作坊", compat: ["Sage"], installs: 6800, installed: false },
  { id: "skill-validation", name: "数据校验规则", version: "0.9", tone: "rose", category: "数据", summary: "为表格生成完整性校验与异常标记规则，随数据更新复跑。", author: "DataCraft", compat: ["Nova"], installs: 3900, installed: false },
  { id: "skill-minute", name: "会议纪要模板", version: "2.2", tone: "teal", category: "办公", summary: "决议、待办、时间线三段式纪要，自动认领负责人。", author: "Fouc 官方", compat: ["Nova"], installs: 10300, installed: false },
]

/** 安装量展示：21300 → 21.3k，整数 k 去掉小数点 */
export function formatInstalls(count: number): string {
  if (count < 1000) return String(count)
  const k = count / 1000
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`
}
