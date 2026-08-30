# Fouc 产品文档

本目录承载 Fouc 的产品定义、V1 设计与交付规划。根目录 README 仅保留稳定、必要的项目入口信息。

## 文档导航

| 文档 | 内容 |
|---|---|
| [01-vision-and-positioning.md](./01-vision-and-positioning.md) | 原始痛点、产品愿景、定位、用户与设计原则 |
| [02-v1-core-features.md](./02-v1-core-features.md) | 五项 V1 核心特性的范围、优先级、价值与验收标准 |
| [03-v1-architecture-and-security.md](./03-v1-architecture-and-security.md) | 参考架构、领域对象、权威来源与安全治理 |
| [04-v1-roadmap-and-metrics.md](./04-v1-roadmap-and-metrics.md) | V1 范围边界、交付阶段与成功指标 |
| [05-local-agent-management.md](./05-local-agent-management.md) | 本机 Agent 的自动发现、能力探测、纳管、任务下发与生命周期控制 |

## V1 核心命题

一名研发人员能否在不迁移本地代码、不在远端配置模型服务的前提下，让本地 Agent 安全获得测试环境事实，并在一个工作对象内完成“受理—定位—修复—验证—审核—回归交接”的可审计闭环。

## 设计基线

- 目标优先于会话；
- 先纳管本机执行能力，再编排上层工作；
- 本地能力结合远程事实；
- 确定性外壳约束概率性执行；
- 联邦事实源，不建设新的内容孤岛；
- 通过制品与证据协作；
- Agent 执行端可替换；
- 风险决定自治度；
- 先闭环一个高价值场景，再扩展通用能力。
