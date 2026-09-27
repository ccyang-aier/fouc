# Fouc V1

> 当前阶段：产品定义与体验原型。

V1 的目标是建立 Fouc 最小但完整的 Agent 工作底座，并用“本地受管 Agent + 远程环境事实 + 多仓代码 + 团队流程”完成一次可监督、可验证的研发问题闭环。

## P0 基础能力

| ID | 基础能力 | 状态 |
|---|---|---|
| F0 | 本机能力与 Agent 控制面 | 未完成 |
| F1 | 本地安全执行内核 | 未完成 |
| F2 | 项目、代码仓与隔离工作区控制面 | 未完成 |
| F3 | 身份、凭据、委托与策略中心 | 未完成 |
| F4 | 持久化工作运行时与事件存储 | 未完成 |
| F5 | 上下文、制品与证据基础设施 | 未完成 |
| F6 | 连接器控制面 | 未完成 |
| F7 | 团队 Workspace、同步与通知 | 未完成 |

每项能力的职责边界、最小实现、依赖和退出标准见 [P0 基础能力清单](./p0-foundation-capabilities.md)。核心特性只有在自身验收标准及其依赖的 P0 退出标准同时通过后，才能标记为完成。

## 特性规划

| 核心特性 | 优先级 | 状态 | 详细设计 |
|---|---|---|---|
| 本机 Agent 自动发现与统一纳管 | P0 | 未完成 | [Agent 纳管](./local-agent-management.md) |
| 统一工作对象与 Work Room | P0 | 未完成 | [核心特性](./core-features.md) |
| 本地—远程联合诊断 | P0 | 未完成 | [核心特性](./core-features.md) |
| 多仓隔离工作区与受管 Agent 编排 | P0 | 未完成 | [核心特性](./core-features.md) |
| 可执行研发流程、验证与交付闭环 | P1 | 未完成 | [核心特性](./core-features.md) |

这里的“完成”指功能已经实现并通过对应验收标准，不以文档、原型或界面已经存在代替功能完成。

## 文档导航

| 文档 | 内容 |
|---|---|
| [p0-foundation-capabilities.md](./p0-foundation-capabilities.md) | 八项 P0 基础能力的职责、边界、依赖与退出标准 |
| [core-features.md](./core-features.md) | 五项核心特性的范围、价值、依赖与验收标准 |
| [local-agent-management.md](./local-agent-management.md) | 本机 Agent 的发现、能力探测、纳管、任务下发与生命周期控制 |
| [architecture-and-security.md](./architecture-and-security.md) | V1 参考架构、领域对象、权威来源与安全治理 |
| [design/arch/fouc-project-structure-design.md](./design/arch/fouc-project-structure-design.md) | 双端工作台的项目结构、服务与设备边界、访客及操作授权模型、重构顺序 |
| [roadmap-and-metrics.md](./roadmap-and-metrics.md) | V1 范围边界、交付阶段、成功指标与试点原则 |
| [design/aionui-architecture-analysis.md](./design/aionui-architecture-analysis.md) | AionUi/AionCore 开源参考项目深度分析：架构、模块、Agent 纳管实现 |
| [design/fouc-agent-management-design.md](./design/fouc-agent-management-design.md) | 本机 Agent 自动发现与统一纳管的实现设计与迁移方案 |

## V1 核心命题

一名研发人员能否在不迁移本地代码、不在远端配置模型服务的前提下，让本地受管 Agent 安全获得测试环境事实，并在一个工作对象内完成“受理—定位—修复—验证—审核—回归交接”的可审计闭环。

## 设计基线

- 先纳管本机执行能力，再编排上层工作；
- 目标优先于会话；
- 本地能力结合远程事实；
- 确定性外壳约束概率性执行；
- 联邦事实源，不建设新的内容孤岛；
- 通过制品与证据协作；
- Agent 执行端可替换；
- 风险决定自治度；
- 先闭环一个高价值场景，再扩展通用能力。
