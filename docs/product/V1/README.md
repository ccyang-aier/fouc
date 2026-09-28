# Fouc V1

V1 以个人和团队共用的 Web / 桌面 AI 工作台为产品范围。工作空间隔离资源；项目与知识库是同一空间下的独立、多实例模块。Agent、连接器、自动化与社区能力按各自实现状态演进。规划内容不能因页面或演示数据存在而标为完成。

## 产品范围

| 文档 | 负责的问题 |
| --- | --- |
| [核心特性](core-features.md) | 用户场景、工作对象与验收行为 |
| [P0 基础能力](p0-foundation-capabilities.md) | 平台能力边界、依赖与退出标准 |
| [路线与指标](roadmap-and-metrics.md) | 交付优先级、范围与度量；时间节奏仅为规划，不代表实现状态 |

## 权威设计

| 主题 | 文档 |
| --- | --- |
| 全产品资源模型、工程结构与运行边界 | [项目结构与架构](design/arch/fouc-project-structure-design.md) |
| 账户、会话与授权 | [统一身份](design/identity/fouc-identity.md) |
| 项目及工作对象体验 | [项目空间](design/projects/fouc-project-space-product-ux-design.md) |
| 知识库与协同编辑 | [知识库](design/knowledgebase/fouc-knowledgebase-product-design.md) |
| Agent 发现、纳管与运行 | [本机 Agent](design/agents/fouc-agent-management-design.md) |
| 连接器共同框架 | [连接器架构](design/connectors/connector-architecture.md) |
| DTS 特有的认证与能力 | [DTS Provider](design/connectors/dts-connector-design.md) |
| 数据存储 Provider 与共享内核 | [数据存储模块](design/connectors/data-storage-module-design.md) |

每个主题直接更新上述文档；不要为评估、实现批次或日期另写一份同主题设计。当前代码协议与运行命令见 [工程文档](../../engineering/README.md)，外部项目研究见 [背景材料](../../background/README.md)。
