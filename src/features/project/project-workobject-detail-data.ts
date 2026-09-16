import type { OutputPerson } from "./project-outputs-data"

/** 执行信息流条目：普通消息 / 工具调用 / 测试结果 / 审批请求 */
export type DetailFeedEntry =
  | {
      kind: "message"
      author: OutputPerson & { bot?: boolean }
      time: string
      text: string
      plan?: { label: string; steps: string[] }
    }
  | { kind: "tool"; tool: string; action: string; state: string; detail: string }
  | {
      kind: "result"
      author: OutputPerson & { bot?: boolean }
      time: string
      caption: string
      suite: string
      pass: number
      fail: number
      skip: number
      rate: string
    }
  | {
      kind: "approval"
      author: OutputPerson & { bot?: boolean }
      time: string
      title: string
      body: string
      badge: string
    }

/** 右侧结果面板的变更文件树（按目录分组） */
export type DetailFileGroup = {
  dir: string
  files: { name: string; add: number; del: number }[]
}

/** 执行详情页数据：由产物页上下文面板进入，按工作对象组织 */
export type WorkObjectDetail = {
  id: string
  title: string
  badge: string
  meta: { label: string; value: string; icon: "user" | "bot" | "none" }[]
  conclusion: string[]
  plan: { label: string; done: boolean }[]
  pending: { text: string; badge: string }
  feed: DetailFeedEntry[]
  composerPlaceholder: string
  scopeChip: string
  files: DetailFileGroup[]
  verification: { label: string; status?: string; value: string; delta?: string }[]
  risk: { level: string; note: string }
  evidence: { label: string; file: string }[]
}

const linMo = { name: "林默", avatar: "/avatars/lin-mo.png" }
const nova = { name: "Nova", bot: true }

export const workObjectDetails: Record<string, WorkObjectDetail> = {
  "Issue-128": {
    id: "Issue-128",
    title: "修复测试环境登录失败",
    badge: "进行中",
    meta: [
      { label: "负责人", value: "林默", icon: "user" },
      { label: "当前 Agent", value: "Nova", icon: "bot" },
      { label: "阶段", value: "实现与验证", icon: "none" },
      { label: "环境", value: "隔离 worktree", icon: "none" },
      { label: "权限", value: "仅本地修改", icon: "none" },
      { label: "验收", value: "3 / 5", icon: "none" },
    ],
    conclusion: [
      "已修复登录接口在测试环境的会话校验问题，重试机制与错误提示优化完成。",
      "通过本地验证，核心功能恢复正常。",
    ],
    plan: [
      { label: "完成单元测试与边界用例", done: true },
      { label: "补充集成测试并验证稳定性", done: true },
      { label: "准备提交评审", done: false },
    ],
    pending: { text: "需要你审批本次变更的范围与回滚策略，以便提交评审。", badge: "需审批" },
    feed: [
      {
        kind: "message",
        author: linMo,
        time: "09:21",
        text: "测试环境一直提示登录失败，线上正常。请帮我定位并修复。",
      },
      {
        kind: "message",
        author: nova,
        time: "09:21",
        text: "收到，我将先复现并定位问题，然后修复并提供验证结果。",
        plan: { label: "执行计划（3 步）", steps: ["复现登录失败场景", "定位会话校验根因", "修复并补充回归用例"] },
      },
      {
        kind: "tool",
        tool: "运行工具",
        action: "运行测试用例",
        state: "已完成",
        detail: "输出：12 通过 · 1 失败 · 0 跳过，详见下方测试结果。",
      },
      {
        kind: "result",
        author: nova,
        time: "09:25",
        caption: "测试结果",
        suite: "登录用例（测试环境）",
        pass: 12,
        fail: 1,
        skip: 0,
        rate: "92.3%",
      },
      {
        kind: "approval",
        author: nova,
        time: "09:26",
        title: "需要你的审批",
        body: "本次变更涉及会话校验逻辑与重试策略，属于中等风险变更，请确认后继续提交评审。",
        badge: "待审批",
      },
    ],
    composerPlaceholder: "描述目标、引用资料，或 @ 一位 Agent...",
    scopeChip: "Issue-128 / 仅本地修改",
    files: [
      {
        dir: "src",
        files: [
          { name: "auth/session_validator.py", add: 78, del: 12 },
          { name: "auth/retry_policy.py", add: 26, del: 8 },
        ],
      },
      {
        dir: "tests",
        files: [{ name: "test_login_retry.py", add: 20, del: 18 }],
      },
    ],
    verification: [
      { label: "单元测试", status: "通过", value: "12 / 12" },
      { label: "集成测试", status: "通过", value: "6 / 6" },
      { label: "端到端测试", status: "通过", value: "3 / 3" },
      { label: "覆盖率", value: "86.7%", delta: "5.2%" },
    ],
    risk: { level: "中等", note: "如回滚不当可能导致会话异常重试，建议保留 1~2 次失败后的保护策略。" },
    evidence: [
      { label: "测试报告", file: "report_2025-05-19_09-25.html" },
      { label: "访问日志（测试环境）", file: "access_log_2025-05-19.log" },
      { label: "变更说明", file: "CHANGELOG.md" },
    ],
  },

  "Feature-156": {
    id: "Feature-156",
    title: "优化连接器性能",
    badge: "进行中",
    meta: [
      { label: "负责人", value: "苏晴", icon: "user" },
      { label: "当前 Agent", value: "Nova", icon: "bot" },
      { label: "阶段", value: "实现与验证", icon: "none" },
      { label: "环境", value: "隔离 worktree", icon: "none" },
      { label: "权限", value: "仅本地修改", icon: "none" },
      { label: "验收", value: "2 / 5", icon: "none" },
    ],
    conclusion: [
      "连接器批量写入路径已完成首轮优化，吞吐提升方案通过本地压测验证。",
      "大批量场景仍存在抖动，需二轮调优。",
    ],
    plan: [
      { label: "完成批处理补丁实现", done: true },
      { label: "采集性能基线并对比", done: true },
      { label: "大容量场景压测", done: false },
      { label: "整理评审材料", done: false },
    ],
    pending: { text: "压测环境需要扩容授权，等待管理员审批。", badge: "需审批" },
    feed: [
      {
        kind: "message",
        author: { name: "苏晴" },
        time: "昨天 17:40",
        text: "连接器在万级批量写入时延迟抖动明显，请优先优化批处理路径。",
      },
      {
        kind: "message",
        author: nova,
        time: "昨天 17:42",
        text: "收到，我先采集性能基线，再针对批处理路径做优化。",
        plan: { label: "执行计划（3 步）", steps: ["采集性能基线", "优化批处理路径", "压测对比并输出报告"] },
      },
      {
        kind: "tool",
        tool: "运行工具",
        action: "性能基线采集",
        state: "已完成",
        detail: "输出：吞吐基线 1,240 ops/s，P99 延迟 182ms。",
      },
      {
        kind: "result",
        author: nova,
        time: "昨天 18:20",
        caption: "压测结果",
        suite: "批量写入（1 万条）",
        pass: 6,
        fail: 0,
        skip: 0,
        rate: "100%",
      },
      {
        kind: "approval",
        author: nova,
        time: "08:12",
        title: "需要你的审批",
        body: "批处理补丁涉及写入幂等语义，属于中等风险变更，请确认后继续压测。",
        badge: "待审批",
      },
    ],
    composerPlaceholder: "描述目标、引用资料，或 @ 一位 Agent...",
    scopeChip: "Feature-156 / 仅本地修改",
    files: [
      {
        dir: "src",
        files: [
          { name: "connectors/batch_writer.py", add: 132, del: 47 },
          { name: "connectors/retry_queue.py", add: 38, del: 12 },
        ],
      },
      {
        dir: "bench",
        files: [{ name: "bench_batch_write.py", add: 64, del: 0 }],
      },
    ],
    verification: [
      { label: "单元测试", status: "通过", value: "18 / 18" },
      { label: "基线对比", status: "通过", value: "3 / 3" },
      { label: "覆盖率", value: "81.2%", delta: "3.8%" },
    ],
    risk: { level: "中等", note: "大批量场景仍存在延迟抖动，需扩容压测后复核。" },
    evidence: [
      { label: "基线数据", file: "bench-0520.csv" },
      { label: "差异文件", file: "diff-517.patch" },
    ],
  },

  "Task-132": {
    id: "Task-132",
    title: "补充接口文档示例",
    badge: "待处理",
    meta: [
      { label: "负责人", value: "李昂", icon: "user" },
      { label: "当前 Agent", value: "Nova", icon: "bot" },
      { label: "阶段", value: "资料准备", icon: "none" },
      { label: "环境", value: "本地沙箱", icon: "none" },
      { label: "权限", value: "仅本地修改", icon: "none" },
      { label: "验收", value: "1 / 4", icon: "none" },
    ],
    conclusion: [
      "接口文档大纲与可执行示例初稿已完成，等待评审后补全参数说明。",
    ],
    plan: [
      { label: "梳理文档结构", done: true },
      { label: "编写可执行示例", done: false },
      { label: "发起文档评审", done: false },
    ],
    pending: { text: "示例依赖的测试账号尚未开通，等待开通后继续。", badge: "需审批" },
    feed: [
      {
        kind: "message",
        author: { name: "李昂" },
        time: "05-18 11:20",
        text: "接口文档缺少可运行示例，请按现有大纲补充。",
      },
      {
        kind: "message",
        author: nova,
        time: "05-18 11:22",
        text: "收到，我先核对大纲结构，然后补充示例与脚本。",
        plan: { label: "执行计划（3 步）", steps: ["核对文档大纲", "编写示例请求集", "自检后提交评审"] },
      },
      {
        kind: "approval",
        author: nova,
        time: "05-18 14:02",
        title: "需要你的审批",
        body: "示例将使用真实接口路径，请确认披露范围后继续。",
        badge: "待审批",
      },
    ],
    composerPlaceholder: "描述目标、引用资料，或 @ 一位 Agent...",
    scopeChip: "Task-132 / 仅本地修改",
    files: [
      {
        dir: "docs",
        files: [
          { name: "api/outline.md", add: 96, del: 3 },
          { name: "api/examples.md", add: 54, del: 0 },
        ],
      },
    ],
    verification: [{ label: "文档自检", status: "通过", value: "8 / 9" }],
    risk: { level: "低", note: "纯文档产出，示例与真实环境隔离。" },
    evidence: [
      { label: "草稿大纲", file: "outline-draft.md" },
      { label: "示例脚本", file: "samples-postman.json" },
    ],
  },
}
