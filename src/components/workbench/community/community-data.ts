/**
 * 社区目录数据：Agents / 连接器 / Skills 三个子页的条目与详情派生。
 * V1 为本地演示数据，后续由社区服务接入替换。
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
  highlights: string[]
  author: string
  version: string
  rating: number
  installs: number
  updated: string
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
  version: string
  updated: string
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
  updated: string
  installed: boolean
}

export const PAGE_SIZE = 12

export const CATEGORIES: Record<CommunityTab, string[]> = {
  agents: ["全部", "研发", "办公", "数据", "内容"],
  connectors: ["全部", "研发协作", "办公协同", "数据源", "设计资产"],
  skills: ["全部", "研发", "办公", "数据"],
}

export const initialCommunityAgents: CommunityAgent[] = [
  { id: "agent-reviewer", name: "代码审查官", glyph: "审", tone: "blue", category: "研发", tagline: "按团队规范评审变更，标记风险点并给出可执行的修改建议。", highlights: ["逐文件评审意见与风险分级", "支持自定义团队规范清单", "评审结论可一键回写任务"], author: "Lint Guild", version: "3.2.1", rating: 4.9, installs: 21300, updated: "2 天前", installed: false },
  { id: "agent-testgen", name: "测试生成器", glyph: "测", tone: "rose", category: "研发", tagline: "依据变更差异生成单元测试与边界用例，直出可运行脚手架。", highlights: ["差异感知的用例选取", "边界与异常路径自动补全", "生成结果可直接落地 CI"], author: "QA Circle", version: "2.8.0", rating: 4.7, installs: 8900, updated: "5 天前", installed: false },
  { id: "agent-release", name: "发布哨兵", glyph: "哨", tone: "sky", category: "研发", tagline: "盯住构建与发布流水线，异常时给出定位线索与回滚建议。", highlights: ["流水线失败自动归因", "发布检查清单 gate", "回滚预案一键生成"], author: "SRE 工作组", version: "1.9.4", rating: 4.8, installs: 6200, updated: "1 天前", installed: false },
  { id: "agent-refactor", name: "重构向导", glyph: "构", tone: "indigo", category: "研发", tagline: "识别代码坏味道并拆解为可分步执行的重构任务。", highlights: ["坏味道扫描与优先级排序", "安全小步重构脚本", "重构前后行为等价校验"], author: "Craft Lab", version: "2.1.0", rating: 4.6, installs: 4800, updated: "1 周前", installed: false },
  { id: "agent-minutes", name: "会议速记员", glyph: "会", tone: "teal", category: "办公", tagline: "从录音与屏幕共享中提炼决议、待办与时间线，同步到任务。", highlights: ["实时转写与说话人识别", "决议 / 待办 / 风险三段结构", "待办自动指派负责人"], author: "Fouc 官方", version: "4.0.2", rating: 4.8, installs: 15200, updated: "3 天前", installed: true },
  { id: "agent-weekly", name: "周报主编", glyph: "报", tone: "amber", category: "办公", tagline: "汇总任务进度与运行记录，编排成结构化周报草稿。", highlights: ["跨空间进度聚合", "亮点与风险自动提炼", "一键导出为飞书文档"], author: "Fouc 官方", version: "2.4.1", rating: 4.7, installs: 9100, updated: "4 天前", installed: false },
  { id: "agent-travel", name: "行程管家", glyph: "程", tone: "sky", category: "办公", tagline: "统筹差旅与日程冲突，给出可执行的行程安排。", highlights: ["多日历冲突检测", "差旅政策内自动选票", "行程变更即时重排"], author: "星野工作坊", version: "1.6.0", rating: 4.5, installs: 3300, updated: "2 周前", installed: false },
  { id: "agent-interviewer", name: "面试教练", glyph: "面", tone: "violet", category: "办公", tagline: "基于岗位 JD 模拟技术面试，逐题给出评分与改进建议。", highlights: ["按 JD 定制题库", "逐题评分与追问", "面试复盘报告"], author: "Offer 更多", version: "3.0.0", rating: 4.6, installs: 3200, updated: "6 天前", installed: false },
  { id: "agent-backfill", name: "数据补全师", glyph: "数", tone: "indigo", category: "数据", tagline: "识别表格缺失字段，从公开源安全补全并标注置信度。", highlights: ["缺失模式识别", "多源交叉验证", "置信度与来源标注"], author: "DataCraft", version: "2.2.3", rating: 4.6, installs: 5400, updated: "1 周前", installed: false },
  { id: "agent-metrics", name: "指标解读师", glyph: "指", tone: "teal", category: "数据", tagline: "对北极星指标的异动做自动归因，输出可读的解读简报。", highlights: ["异动自动检测", "多维下钻归因", "归因结论带证据链"], author: "DataCraft", version: "1.8.1", rating: 4.7, installs: 4100, updated: "3 天前", installed: false },
  { id: "agent-cleaner", name: "表格清洗员", glyph: "洗", tone: "rose", category: "数据", tagline: "批量清洗格式混乱的表格：去重、规范化、异常标记。", highlights: ["列类型自动推断", "重复与冲突合并", "清洗步骤可回放"], author: "表格公社", version: "2.0.5", rating: 4.5, installs: 3700, updated: "5 天前", installed: false },
  { id: "agent-competitor", name: "竞品雷达", glyph: "竞", tone: "violet", category: "内容", tagline: "持续追踪竞品版本与定价动态，产出周度对比简报。", highlights: ["版本 / 定价 / 招聘三线追踪", "动态时间线沉淀", "周报自动生成"], author: "星野工作坊", version: "3.1.0", rating: 4.8, installs: 9600, updated: "2 天前", installed: false },
  { id: "agent-translator", name: "翻译本地化", glyph: "译", tone: "sky", category: "内容", tagline: "面向产品文案的多语言本地化，自动保持术语与语气一致。", highlights: ["术语库与语气约束", "多语言并行交付", "回译质检报告"], author: "Fouc 官方", version: "5.0.1", rating: 4.9, installs: 11700, updated: "1 天前", installed: false },
  { id: "agent-writer", name: "文档作家", glyph: "文", tone: "amber", category: "内容", tagline: "把粗糙要点扩写为结构清晰的产品文档与发布说明。", highlights: ["要点到章节自动编排", "术语一致性校对", "多模板输出"], author: "墨迹工作室", version: "2.6.0", rating: 4.7, installs: 7100, updated: "4 天前", installed: false },
  { id: "agent-wechat", name: "公众号主笔", glyph: "稿", tone: "rose", category: "内容", tagline: "围绕选题产出公众号长文初稿，配好小标题与配图建议。", highlights: ["选题库灵感续写", "小标题节奏把控", "配图建议与版权提示"], author: "墨迹工作室", version: "1.4.2", rating: 4.4, installs: 2900, updated: "1 周前", installed: false },
  { id: "agent-script", name: "短视频脚本", glyph: "本", tone: "amber", category: "内容", tagline: "生成口播脚本与分镜提示，节奏对齐平台特性。", highlights: ["黄金 3 秒开头模板", "分镜与口播分离", "多平台节奏变体"], author: "星野工作坊", version: "1.2.0", rating: 4.3, installs: 2100, updated: "2 周前", installed: false },
]

export const initialCommunityConnectors: CommunityConnector[] = [
  { id: "connector-github", name: "GitHub", glyph: "GH", tone: "slate", category: "研发协作", description: "同步仓库、Issue 与 PR 状态到任务流，提交即更新进度。", publisher: "GitHub, Inc.", version: "4.3.0", updated: "1 天前", connected: true },
  { id: "connector-gitlab", name: "GitLab", glyph: "GL", tone: "rose", category: "研发协作", description: "接入 GitLab 仓库与流水线状态，MR 联动任务评审。", publisher: "GitLab B.V.", version: "3.1.2", updated: "3 天前", connected: false },
  { id: "connector-sentry", name: "Sentry", glyph: "Se", tone: "rose", category: "研发协作", description: "引入错误与性能事件，异常自动建单并关联版本。", publisher: "Functional Software, Inc.", version: "2.4.0", updated: "4 天前", connected: false },
  { id: "connector-jira", name: "Jira", glyph: "Ji", tone: "blue", category: "研发协作", description: "导入看板与缺陷单，状态变更联动任务与里程碑。", publisher: "Atlassian", version: "5.2.1", updated: "1 周前", connected: false },
  { id: "connector-feishu", name: "飞书", glyph: "飞", tone: "sky", category: "办公协同", description: "群消息、云文档与日历事件接入工作台，@机器人即可派活。", publisher: "字节跳动", version: "6.0.3", updated: "2 天前", connected: true },
  { id: "connector-dingtalk", name: "钉钉", glyph: "钉", tone: "sky", category: "办公协同", description: "审批与考勤事件驱动的自动化，结果回传群卡片。", publisher: "钉钉", version: "3.8.0", updated: "5 天前", connected: false },
  { id: "connector-wecom", name: "企业微信", glyph: "企", tone: "teal", category: "办公协同", description: "客户群与内部应用消息互通，外部协作进工作台。", publisher: "腾讯", version: "2.9.1", updated: "1 周前", connected: false },
  { id: "connector-notion", name: "Notion", glyph: "No", tone: "slate", category: "办公协同", description: "双向同步数据库与文档页面，作为长期知识上下文引用。", publisher: "Notion Labs", version: "4.1.0", updated: "3 天前", connected: false },
  { id: "connector-gdrive", name: "Google Drive", glyph: "GD", tone: "amber", category: "办公协同", description: "检索并引用云端文档附件，变更时刷新任务上下文。", publisher: "Google", version: "3.5.2", updated: "6 天前", connected: false },
  { id: "connector-shimo", name: "石墨文档", glyph: "墨", tone: "slate", category: "办公协同", description: "文档与表格轻量接入，评论与 @ 事件可驱动任务。", publisher: "石墨文档", version: "1.9.0", updated: "2 周前", connected: false },
  { id: "connector-postgres", name: "PostgreSQL", glyph: "PG", tone: "indigo", category: "数据源", description: "只读连接查询业务库，分析结果可物化回写指定 schema。", publisher: "社区维护", version: "5.1.0", updated: "2 天前", connected: false },
  { id: "connector-mysql", name: "MySQL", glyph: "My", tone: "blue", category: "数据源", description: "安全连接 MySQL 实例，慢查询与表结构随时可查。", publisher: "社区维护", version: "4.7.2", updated: "1 周前", connected: false },
  { id: "connector-figma", name: "Figma", glyph: "Fi", tone: "rose", category: "设计资产", description: "把设计稿版本与标注挂接到工作对象，改动自动提醒。", publisher: "Figma, Inc.", version: "3.3.4", updated: "3 天前", connected: false },
  { id: "connector-jsdesign", name: "即时设计", glyph: "即", tone: "violet", category: "设计资产", description: "国产设计工具文件接入，标注与切图直连任务。", publisher: "云协同科技", version: "2.0.1", updated: "5 天前", connected: false },
]

export const initialCommunitySkills: CommunitySkill[] = [
  { id: "skill-review", name: "评审清单", version: "3.0", tone: "blue", category: "研发", summary: "按团队规范生成变更评审 checklist，覆盖安全与性能基线。", author: "Lint Guild", compat: ["Codey"], installs: 12600, updated: "2 天前", installed: false },
  { id: "skill-apiread", name: "API 文档速读", version: "1.5", tone: "sky", category: "研发", summary: "抽取端点、鉴权与限流要点，生成一页速查卡。", author: "星野工作坊", compat: ["Codey", "Sage"], installs: 7700, updated: "4 天前", installed: false },
  { id: "skill-unittest", name: "单测补全", version: "2.2", tone: "teal", category: "研发", summary: "为存量函数补齐单元测试骨架与断言建议。", author: "QA Circle", compat: ["Codey"], installs: 8400, updated: "3 天前", installed: false },
  { id: "skill-depaudit", name: "依赖体检", version: "1.7", tone: "rose", category: "研发", summary: "扫描依赖漏洞与许可证风险，给出升级路径。", author: "SRE 工作组", compat: ["Codey", "Nova"], installs: 5200, updated: "1 周前", installed: false },
  { id: "skill-regex", name: "正则生成器", version: "2.0", tone: "blue", category: "研发", summary: "自然语言描述直出正则与用例，附逐步解释。", author: "Craft Lab", compat: ["Nova", "Sage"], installs: 6900, updated: "5 天前", installed: false },
  { id: "skill-slides", name: "PPT 大纲师", version: "2.0", tone: "amber", category: "办公", summary: "从主题到逐页大纲与讲者备注，支持品牌模板约束。", author: "墨迹工作室", compat: ["Nova", "Sage"], installs: 14100, updated: "3 天前", installed: false },
  { id: "skill-weekly", name: "周报编排", version: "1.8", tone: "teal", category: "办公", summary: "汇总任务进度与运行记录，产出结构化周报草稿。", author: "Fouc 官方", compat: ["Nova"], installs: 9400, updated: "6 天前", installed: false },
  { id: "skill-minutes", name: "会议纪要模板", version: "2.2", tone: "teal", category: "办公", summary: "决议、待办、时间线三段式纪要，自动认领负责人。", author: "Fouc 官方", compat: ["Nova"], installs: 10300, updated: "2 天前", installed: false },
  { id: "skill-email", name: "邮件措辞润色", version: "1.3", tone: "sky", category: "办公", summary: "按场合与语气重写邮件，保留原意去掉情绪。", author: "星野工作坊", compat: ["Nova"], installs: 6100, updated: "1 周前", installed: false },
  { id: "skill-brainstorm", name: "头脑风暴主持", version: "1.1", tone: "violet", category: "办公", summary: "主持一场有收敛节奏的头脑风暴，产出可投票方案。", author: "星野工作坊", compat: ["Nova", "Sage"], installs: 4400, updated: "2 周前", installed: false },
  { id: "skill-release-note", name: "发布说明生成", version: "1.6", tone: "amber", category: "办公", summary: "从提交历史生成面向用户的发布说明。", author: "Fouc 官方", compat: ["Nova", "Codey"], installs: 7800, updated: "4 天前", installed: false },
  { id: "skill-sql", name: "SQL 查询生成", version: "2.3", tone: "indigo", category: "数据", summary: "从自然语言问题生成可审查的 SQL 与执行计划，附表结构说明。", author: "DataCraft", compat: ["Nova", "Sage"], installs: 18200, updated: "1 天前", installed: true },
  { id: "skill-validation", name: "数据校验规则", version: "0.9", tone: "rose", category: "数据", summary: "为表格生成完整性校验与异常标记规则，随数据更新复跑。", author: "DataCraft", compat: ["Nova"], installs: 3900, updated: "1 周前", installed: false },
  { id: "skill-competitor", name: "竞品分析框架", version: "1.2", tone: "violet", category: "数据", summary: "定位、定价与功能矩阵的标准化拆解，输出对比结论。", author: "星野工作坊", compat: ["Sage"], installs: 6800, updated: "5 天前", installed: false },
  { id: "skill-attribution", name: "归因分析", version: "1.0", tone: "indigo", category: "数据", summary: "对指标变化做贡献度拆解，定位主要驱动因子。", author: "DataCraft", compat: ["Sage"], installs: 3100, updated: "2 周前", installed: false },
  { id: "skill-chart", name: "图表建议", version: "1.4", tone: "teal", category: "数据", summary: "按数据形态推荐图表类型并给出配色与标注规范。", author: "墨迹工作室", compat: ["Nova", "Sage"], installs: 4600, updated: "6 天前", installed: false },
]

/** 安装量展示：21300 → 21.3k，整数 k 去掉小数点 */
export function formatInstalls(count: number): string {
  if (count < 1000) return String(count)
  const k = count / 1000
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`
}

// ─── 详情派生 ──────────────────────────────────────────────────────────

export type CommunityDetail = {
  tab: CommunityTab
  name: string
  glyph: string
  tone: IconTone
  category: string
  byline: string
  description: string
  highlights: string[]
  stats: Array<{ label: string; value: string }>
  info: Array<{ label: string; value: string }>
  updates: Array<{ version: string; date: string; note: string }>
  permissions: string[]
}

const UPDATE_DATES = ["2026-09-08", "2026-08-21", "2026-08-02"] as const

const UPDATE_NOTES: Record<CommunityTab, [string, string, string]> = {
  agents: ["优化长上下文任务的响应稳定性", "新增快捷指令集与团队规范继承", "修复若干边角案例与提示词回归"],
  connectors: ["提升同步稳定性与限流退避策略", "支持新版 Webhook 事件订阅", "修复偶发的授权过期问题"],
  skills: ["精简提示词体积，响应更快", "适配最新模型工具调用协议", "修复边界输入下的格式问题"],
}

const PERMISSIONS: Record<CommunityTab, string[]> = {
  agents: ["读取任务上下文与工作区文件（可随时撤销）", "执行命令前逐条弹出确认", "运行日志仅保留在本机"],
  connectors: ["OAuth 只读授权，凭据加密存储于本机", "同步频率与数据范围可随时调整", "断开连接即删除远端令牌"],
  skills: ["仅在任务内加载提示词与模板", "不发起网络请求（纯本地技能）", "可随时卸载并清理缓存"],
}

function prevVersions(version: string): [string, string] {
  const parts = version.split(".")
  if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
    const [a, b, c] = parts.map(Number)
    return [c > 0 ? `${a}.${b}.${c - 1}` : `${a}.${Math.max(b - 1, 0)}.3`, b > 0 ? `${a}.${b - 1}.2` : `${a}.0.9`]
  }
  const n = Number(version) || 1
  return [(n - 0.1).toFixed(1), (n - 0.2).toFixed(1)]
}

function buildUpdates(tab: CommunityTab, version: string) {
  const [p1, p2] = prevVersions(version)
  return UPDATE_DATES.map((date, index) => ({
    version: [version, p1, p2][index],
    date,
    note: UPDATE_NOTES[tab][index],
  }))
}

export function buildCommunityDetail(
  tab: CommunityTab,
  item: CommunityAgent | CommunityConnector | CommunitySkill
): CommunityDetail {
  const updates = buildUpdates(tab, item.version)
  if (tab === "agents") {
    const agent = item as CommunityAgent
    return {
      tab,
      name: agent.name,
      glyph: agent.glyph,
      tone: agent.tone,
      category: agent.category,
      byline: `by ${agent.author}`,
      description: agent.tagline,
      highlights: agent.highlights,
      stats: [
        { label: "评分", value: `★ ${agent.rating}` },
        { label: "安装量", value: formatInstalls(agent.installs) },
        { label: "版本", value: `v${agent.version}` },
        { label: "更新", value: agent.updated },
      ],
      info: [
        { label: "分类", value: agent.category },
        { label: "作者", value: agent.author },
        { label: "版本", value: `v${agent.version}` },
        { label: "评分", value: `★ ${agent.rating}` },
        { label: "安装量", value: formatInstalls(agent.installs) },
        { label: "更新时间", value: agent.updated },
      ],
      updates,
      permissions: PERMISSIONS.agents,
    }
  }
  if (tab === "connectors") {
    const connector = item as CommunityConnector
    return {
      tab,
      name: connector.name,
      glyph: connector.glyph,
      tone: connector.tone,
      category: connector.category,
      byline: connector.publisher,
      description: connector.description,
      highlights: ["OAuth 授权与令牌自动轮换", "事件与定时两种同步模式", "失败自动重试与告警"],
      stats: [
        { label: "发布者", value: connector.publisher },
        { label: "版本", value: `v${connector.version}` },
        { label: "更新", value: connector.updated },
        { label: "状态", value: connector.connected ? "已连接" : "未连接" },
      ],
      info: [
        { label: "发布者", value: connector.publisher },
        { label: "分类", value: connector.category },
        { label: "版本", value: `v${connector.version}` },
        { label: "更新时间", value: connector.updated },
        { label: "状态", value: connector.connected ? "已连接" : "未连接" },
      ],
      updates,
      permissions: PERMISSIONS.connectors,
    }
  }
  const skill = item as CommunitySkill
  return {
    tab: "skills",
    name: skill.name,
    glyph: skill.name.slice(0, 1),
    tone: skill.tone,
    category: skill.category,
    byline: `by ${skill.author}`,
    description: skill.summary,
    highlights: [`由 ${skill.author} 维护，随版本热更新`, "在任务中 @ 引用即可生效", `与 ${skill.compat.join(" / ")} 协同最佳`],
    stats: [
      { label: "安装量", value: formatInstalls(skill.installs) },
      { label: "版本", value: `v${skill.version}` },
      { label: "适配 Agent", value: `${skill.compat.length} 位` },
      { label: "更新", value: skill.updated },
    ],
    info: [
      { label: "分类", value: skill.category },
      { label: "作者", value: skill.author },
      { label: "适配 Agent", value: skill.compat.join(" / ") },
      { label: "版本", value: `v${skill.version}` },
      { label: "安装量", value: formatInstalls(skill.installs) },
      { label: "更新时间", value: skill.updated },
    ],
    updates,
    permissions: PERMISSIONS.skills,
  }
}
