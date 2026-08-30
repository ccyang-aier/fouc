# Fouc

> 面向个人与企业团队的 AI Agent 超级工作台。

Fouc 不是新的 Coding Agent。它构建在 Codex、Claude Code 等 Agent 之上，统一组织任务、上下文、工具、人员与企业流程，让复杂工作可执行、可监督、可验证、可闭环。

项目目前处于产品定义与体验原型阶段。

## 为什么做 Fouc

企业研发的真实工作分散在本地代码、远程环境、问题单、文档、CI/CD 和审批流程中。Coding Agent 擅长理解与修改代码，却通常缺少跨环境诊断、团队流程、权限治理和交付闭环。

Fouc 首先解决一个具体问题：研发人员无需把源码、Agent 和模型凭据搬到测试或客户环境，也能让本地 Agent 安全结合远程运行事实，完成问题定位、修复、验证、审核与回归。

## 产品愿景

Fouc 希望成为 Agent 原生的超级工作台：

- 人负责目标、约束、关键判断与最终责任；
- Agent 负责理解上下文、执行任务并提交可验证结果；
- Fouc 负责组织工作、编排流程、控制权限和保留证据；
- 不同 Agent 是可替换的执行器，代码仓、工单和环境仍是事实的权威来源。

长期来看，Fouc 将从研发场景扩展到研究、分析、项目协作与日常办公。

## V1 方向

V1 聚焦“远程问题定位与问题单闭环”，验证以下核心能力：

1. 自动发现并纳管用户机器上的 Codex、Claude Code、OpenCode 等 Agent；
2. 统一工作对象与 Work Room；
3. 本地—远程联合诊断；
4. 多仓隔离工作区与任务编排；
5. 可执行研发流程、验证与交付闭环。

完整设计见 [V1 核心特性](./docs/product/02-v1-core-features.md)。

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
- [产品背景、愿景与定位](./docs/product/01-vision-and-positioning.md)
- [V1 核心特性](./docs/product/02-v1-core-features.md)
- [本地 Agent 发现与纳管](./docs/product/05-local-agent-management.md)
- [V1 架构与安全设计](./docs/product/03-v1-architecture-and-security.md)
- [V1 范围、路线与成功指标](./docs/product/04-v1-roadmap-and-metrics.md)
- [Agent 研发与企业办公调研](./docs/background/README.md)
