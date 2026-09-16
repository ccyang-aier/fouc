import { FileCode, FileText, Pulse, SealCheck } from "@phosphor-icons/react"

/** 产物人物（创建者 / 评审人），avatar 缺省时由头像组件回退为首字符圆形 */
export type OutputPerson = { name: string; avatar?: string }

/** 产物类型目录：图标与生命周期阶段共用同一份映射 */
export const outputTypeMeta = {
  analysis: { label: "问题分析", icon: Pulse, stage: "分析阶段" },
  code: { label: "代码变更", icon: FileCode, stage: "实现阶段" },
  report: { label: "测试报告", icon: FileText, stage: "验证阶段" },
  review: { label: "评审记录", icon: SealCheck, stage: "评审阶段" },
} as const

export type OutputType = keyof typeof outputTypeMeta

/** 产物状态（工作对象状态为独立目录，见 workStatus） */
export const outputStatusMeta = {
  pending: { label: "待评审" },
  merged: { label: "已合并" },
  draft: { label: "草稿" },
} as const

export type OutputStatus = keyof typeof outputStatusMeta

/** 工作对象状态（分组行展示） */
export const workStatus = {
  reviewing: { label: "待评审" },
  developing: { label: "开发中" },
  todo: { label: "待处理" },
} as const

export type WorkObjectStatus = keyof typeof workStatus

/** 右侧「项目上下文」面板的产物详情 */
export type OutputDetail = {
  summary: string
  creator: OutputPerson & { at: string }
  relatedTask: { id: string; title: string }
  review: {
    status: string
    approved: number
    total: number
    reviewers: (OutputPerson & { chair?: boolean })[]
  }
  checklist: { label: string; done: boolean }[]
  evidence: { label: string; file: string }[]
  risk: { level: string; note: string }
}

export type OutputEntry = {
  id: string
  name: string
  type: OutputType
  status: OutputStatus
  version: string
  /** 验证进度百分比，null 表示尚无验证（表格展示为 —） */
  verification: number | null
  updated: string
  detail: OutputDetail
}

export type WorkObjectGroup = {
  id: string
  title: string
  owner: OutputPerson
  status: WorkObjectStatus
  /** 验收进度百分比 */
  acceptance: number
  outputs: OutputEntry[]
}

const linMo: OutputPerson = { name: "林默", avatar: "/avatars/lin-mo.png" }
const suQing: OutputPerson = { name: "苏晴" }
const liAng: OutputPerson = { name: "李昂" }

/** 评审人目录：同一批评审人在项目内复用 */
const reviewPanel = {
  duo: [
    { ...suQing, chair: true },
    liAng,
  ],
  lin: [{ ...linMo, chair: true }],
  su: [{ ...suQing, chair: true }],
} satisfies Record<string, (OutputPerson & { chair?: boolean })[]>

export const initialOutputGroups: WorkObjectGroup[] = [
  {
    id: "Issue-128",
    title: "修复测试环境登录失败",
    owner: linMo,
    status: "reviewing",
    acceptance: 80,
    outputs: [
      {
        id: "ISSUE-128-ROOT-CAUSE",
        name: "根因分析",
        type: "analysis",
        status: "pending",
        version: "v1.2.0",
        verification: 80,
        updated: "2025-05-20 11:15",
        detail: {
          summary: "问题分析文档",
          creator: { ...linMo, at: "2025-05-20 10:30" },
          relatedTask: { id: "WO-217", title: "测试方案优化" },
          review: { status: "待评审", approved: 1, total: 2, reviewers: reviewPanel.duo },
          checklist: [
            { label: "复现步骤已验证", done: true },
            { label: "日志与指标一致", done: true },
            { label: "根因定位清晰", done: false },
            { label: "修复方案可行", done: false },
          ],
          evidence: [
            { label: "日志样本", file: "log-20250519.zip" },
            { label: "堆栈快照", file: "stack-20250519.txt" },
          ],
          risk: { level: "中", note: "已知风险已记录，监控中" },
        },
      },
      {
        id: "ISSUE-128-CODE-482",
        name: "代码变更集 #482",
        type: "code",
        status: "merged",
        version: "v1.0.0",
        verification: null,
        updated: "2025-05-20 10:40",
        detail: {
          summary: "修复补丁与提交记录",
          creator: { ...linMo, at: "2025-05-20 10:35" },
          relatedTask: { id: "WO-217", title: "测试方案优化" },
          review: { status: "已合并", approved: 2, total: 2, reviewers: reviewPanel.duo },
          checklist: [
            { label: "单元测试通过", done: true },
            { label: "回归用例通过", done: true },
            { label: "代码评审完成", done: true },
            { label: "变更说明已更新", done: false },
          ],
          evidence: [
            { label: "提交补丁", file: "commit-482.patch" },
            { label: "流水线日志", file: "pipeline-482.log" },
          ],
          risk: { level: "低", note: "已带特性开关，可随时回滚" },
        },
      },
      {
        id: "ISSUE-128-REGRESSION",
        name: "回归测试报告",
        type: "report",
        status: "pending",
        version: "v1.0.0",
        verification: 70,
        updated: "2025-05-20 09:32",
        detail: {
          summary: "回归测试执行记录",
          creator: { ...liAng, at: "2025-05-20 09:20" },
          relatedTask: { id: "WO-217", title: "测试方案优化" },
          review: { status: "待评审", approved: 0, total: 2, reviewers: reviewPanel.duo },
          checklist: [
            { label: "用例覆盖完整", done: true },
            { label: "结果已复核", done: true },
            { label: "环境已快照", done: false },
            { label: "指标已归档", done: false },
          ],
          evidence: [
            { label: "测试数据", file: "cases-0520.csv" },
            { label: "执行报告", file: "report-0520.pdf" },
          ],
          risk: { level: "低", note: "存在 1 项非阻塞缺陷待跟踪" },
        },
      },
      {
        id: "ISSUE-128-VERDICT",
        name: "评审决定",
        type: "review",
        status: "pending",
        version: "v1.0.0",
        verification: null,
        updated: "2025-05-20 09:10",
        detail: {
          summary: "评审结论与行动项",
          creator: { ...suQing, at: "2025-05-20 09:05" },
          relatedTask: { id: "WO-217", title: "测试方案优化" },
          review: { status: "待评审", approved: 1, total: 2, reviewers: reviewPanel.duo },
          checklist: [
            { label: "结论已确认", done: true },
            { label: "行动项已分派", done: true },
            { label: "遗留项已登记", done: false },
            { label: "通知已发送", done: false },
          ],
          evidence: [{ label: "评审纪要", file: "minutes-0520.md" }],
          risk: { level: "中", note: "一项修复需在下个迭代复核" },
        },
      },
    ],
  },
  {
    id: "Feature-156",
    title: "优化连接器性能",
    owner: suQing,
    status: "developing",
    acceptance: 45,
    outputs: [
      {
        id: "FEATURE-156-BENCH",
        name: "连接器性能基线",
        type: "report",
        status: "pending",
        version: "v0.3.0",
        verification: 45,
        updated: "2025-05-20 08:12",
        detail: {
          summary: "性能基线测量记录",
          creator: { ...suQing, at: "2025-05-20 08:00" },
          relatedTask: { id: "WO-224", title: "连接器提速专项" },
          review: { status: "待评审", approved: 0, total: 2, reviewers: reviewPanel.duo },
          checklist: [
            { label: "基线已采集", done: true },
            { label: "场景已覆盖", done: true },
            { label: "数据已校验", done: false },
            { label: "报告已归档", done: false },
          ],
          evidence: [{ label: "基线数据", file: "bench-0520.csv" }],
          risk: { level: "低", note: "采样窗口较短，待扩容复测" },
        },
      },
      {
        id: "FEATURE-156-PATCH-517",
        name: "批处理补丁 #517",
        type: "code",
        status: "draft",
        version: "v0.2.0",
        verification: null,
        updated: "2025-05-19 18:20",
        detail: {
          summary: "批量写入优化补丁",
          creator: { ...linMo, at: "2025-05-19 18:02" },
          relatedTask: { id: "WO-224", title: "连接器提速专项" },
          review: { status: "草稿", approved: 0, total: 2, reviewers: reviewPanel.duo },
          checklist: [
            { label: "本地验证通过", done: true },
            { label: "压测报告就绪", done: false },
            { label: "评审会议已约", done: false },
          ],
          evidence: [{ label: "差异文件", file: "diff-517.patch" }],
          risk: { level: "中", note: "大批量场景仍存在抖动" },
        },
      },
      {
        id: "FEATURE-156-PLAN",
        name: "连接器重构方案",
        type: "analysis",
        status: "merged",
        version: "v1.1.0",
        verification: null,
        updated: "2025-05-19 15:05",
        detail: {
          summary: "重构设计与容量评估",
          creator: { ...suQing, at: "2025-05-19 14:40" },
          relatedTask: { id: "WO-224", title: "连接器提速专项" },
          review: { status: "已合并", approved: 2, total: 2, reviewers: reviewPanel.duo },
          checklist: [
            { label: "方案已评审", done: true },
            { label: "容量已评估", done: true },
            { label: "回滚预案就绪", done: true },
            { label: "落地排期确认", done: true },
          ],
          evidence: [{ label: "评审纪要", file: "minutes-0519.md" }],
          risk: { level: "低", note: "方案已定稿，按排期推进" },
        },
      },
    ],
  },
  {
    id: "Task-132",
    title: "补充接口文档示例",
    owner: liAng,
    status: "todo",
    acceptance: 0,
    outputs: [
      {
        id: "TASK-132-OUTLINE",
        name: "接口文档大纲",
        type: "analysis",
        status: "draft",
        version: "v0.1.0",
        verification: 0,
        updated: "2025-05-18 14:02",
        detail: {
          summary: "文档结构与示例规划",
          creator: { ...liAng, at: "2025-05-18 11:30" },
          relatedTask: { id: "WO-231", title: "接口文档补全" },
          review: { status: "草稿", approved: 0, total: 1, reviewers: reviewPanel.lin },
          checklist: [
            { label: "结构已梳理", done: true },
            { label: "示例已收集", done: false },
            { label: "评审待发起", done: false },
          ],
          evidence: [{ label: "草稿大纲", file: "outline-draft.md" }],
          risk: { level: "低", note: "纯文档产出，风险有限" },
        },
      },
      {
        id: "TASK-132-SAMPLES",
        name: "示例请求集",
        type: "code",
        status: "draft",
        version: "v0.1.0",
        verification: null,
        updated: "2025-05-18 11:40",
        detail: {
          summary: "可执行示例与脚本",
          creator: { ...liAng, at: "2025-05-18 11:35" },
          relatedTask: { id: "WO-231", title: "接口文档补全" },
          review: { status: "草稿", approved: 0, total: 1, reviewers: reviewPanel.lin },
          checklist: [
            { label: "请求可运行", done: true },
            { label: "响应已校验", done: false },
          ],
          evidence: [{ label: "示例脚本", file: "samples-postman.json" }],
          risk: { level: "低", note: "示例与真实环境隔离" },
        },
      },
    ],
  },
]

/** 按生命周期分组的阶段顺序（沿用类型目录的 stage 映射） */
export const lifecycleStageOrder = ["analysis", "code", "report", "review"] as const
