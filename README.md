# Fouc

> 面向个人与企业团队的 AI Agent 超级工作台。

Fouc 不是新的 Coding Agent。它构建在 Codex、Claude Code、OpenCode 等 Agent 之上，统一组织任务、上下文、工具、人员与工作流程，让复杂工作可执行、可监督、可验证、可闭环。

## 背景与目标

AI Agent 正在从辅助工具演进为能够接受委托、持续执行并交付结果的新型工作能力。与此同时，个人和团队使用的 Agent、代码仓、文档、环境、业务系统与协作流程仍然彼此分散，缺少统一的工作入口、执行控制和结果治理。

Fouc 的目标是成为 Agent 原生的超级工作台：

- 纳管用户已有的 Agent、工具、项目与数据连接；
- 以目标和工作对象组织任务，而不是以聊天会话组织工作；
- 支持人与 Agent 在同一条流程中分工、审批、接管与协作；
- 让执行过程可观察，权限边界可控制，最终结果可验证；
- 同时服务个人与团队，并从研发扩展到研究、分析和日常办公。

## 版本规划

Fouc 当前处于 **V1 产品定义与体验原型阶段**。

### V1

V1 负责建立 Fouc 最小但完整的 Agent 工作底座，并用远程问题定位与研发问题闭环验证其实际价值。

| 规划特性 | 优先级 | 状态 |
|---|---|---|
| 本机 Agent 自动发现与统一纳管 | P0 | 未完成 |
| 统一工作对象与 Work Room | P0 | 未完成 |
| 本地—远程联合诊断 | P0 | 未完成 |
| 多仓隔离工作区与受管 Agent 编排 | P0 | 未完成 |
| 可执行研发流程、验证与交付闭环 | P1 | 未完成 |

详细范围、验收标准与实现路线见 [V1 产品文档](./docs/product/V1/README.md)。

## 技术栈

- Next.js App Router + React + TypeScript
- Tailwind CSS v4 + Radix primitives
- Tauri v2
- Tauri 原生应用存储

## 本地开发

环境要求：Node.js 22+、pnpm 10.29.3，以及 Tauri 所需的 Rust 与平台工具链。

```bash
pnpm install
pnpm dev
```

```bash
pnpm check           # 类型检查、Lint 与 Web 构建
pnpm desktop:dev     # 启动桌面端开发环境
pnpm desktop:build   # 构建桌面端安装产物
```

## 文档

- [产品文档导航](./docs/product/README.md)
- [产品愿景与定位](./docs/product/vision-and-positioning.md)
- [V1 产品文档](./docs/product/V1/README.md)
- [Agent 研发与企业办公调研](./docs/background/README.md)
