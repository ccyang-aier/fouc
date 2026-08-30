# Fouc V1 架构与安全设计

## 一、架构原则

Fouc 采用“薄控制层 + 可替换执行端 + 联邦事实源”的架构，而不是把所有能力堆进一个单体 Agent。

```text
┌──────────────────────────── Fouc Workbench ────────────────────────────┐
│ Work Room · Agent Assets · Runs · Review Inbox · Artifact · Evidence  │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
┌──────────────────────────── Control Plane ─────────────────────────────┐
│ Work Registry │ Workflow │ Context Broker │ Policy │ Evidence/Eval    │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
┌──────────────────── Local Agent Management Plane ──────────────────────┐
│ Discovery │ Registry │ Capability │ Driver Router │ Session Supervisor│
└───────────────┬──────────────────────┬─────────────────────────────────┘
                │                      │
┌───────────────▼──────────────┐  ┌────▼──────────┐  ┌──────────────────┐
│ Agent Drivers                │  │ Git/Repo      │  │ Remote/Enterprise│
│ Codex · Claude · OpenCode    │  │ Workspace     │  │ Connectors       │
└───────────────┬──────────────┘  └────┬──────────┘  └────────┬─────────┘
                │                      │                      │
┌───────────────▼──────────────────────▼───┐   ┌──────────────▼─────────┐
│ Local trusted execution                 │   │ Test/customer systems   │
│ installed agents · source · worktrees   │   │ runtime facts · issues  │
└─────────────────────────────────────────┘   └────────────────────────┘
```

## 二、架构分层

| 层 | 责任 | V1 重点 |
|---|---|---|
| 体验层 | Work Room、任务创建、运行观察、审核与接管 | 桌面端优先，Web 提供团队协作视图 |
| 工作与流程层 | 工作对象、状态机、关系、角色、事件 | Issue 与轻量 ChangeSet |
| 上下文层 | 从权威来源组装最小 Context Pack | 代码、环境快照、问题单、验证证据 |
| 编排与策略层 | 任务派发、暂停恢复、审批、风险与权限 | 单协调者、确定性门禁、完整审计 |
| 本地 Agent 管理层 | Agent 发现、能力探测、Driver、会话与进程监督 | Codex、Claude Code、OpenCode 的基线纳管 |
| 能力接入层 | Git、远程环境、问题系统、CI 适配 | 少量高价值连接器，接口保持稳定 |
| 执行层 | 本地隔离工作区与远程受控动作 | 本地执行为主，远端默认只读 |
| 证据与评测层 | Trace、测试、快照、审批、结果评价 | 支撑关闭条件与 V1 效果度量 |

## 三、本地 Agent 管理平面

本地 Agent 管理平面是控制层与具体 CLI 之间的稳定边界，包含：

- **Discovery Service**：从 `PATH`、常见安装位置和用户指定路径发现候选 Agent；
- **Agent Registry**：保存安装实例、Profile、版本、健康状态和用户选择；
- **Capability Resolver**：结合 Provider、版本与探测结果生成真实能力清单；
- **Driver Router**：把统一操作路由到 Codex、Claude Code、OpenCode 等专用 Driver；
- **Session Supervisor**：管理进程、PTY/事件流、会话、取消、恢复、超时与遗留进程；
- **Policy Binding**：把工作对象、用户授权、工作目录、环境变量和 AgentRun 绑定起来。

上层工作流不得直接拼接 CLI 命令。所有 Agent 操作必须经过 Driver 与 Supervisor，以获得一致的状态、权限、失败和审计语义。详细设计见 [本地 Agent 发现与纳管](./05-local-agent-management.md)。

## 四、核心领域对象

| 对象 | 作用 |
|---|---|
| `Workspace` | 个人或团队的权限、资源和策略边界 |
| `WorkObject` | Issue、Requirement、ChangeSet 等有生命周期的工作实体 |
| `TaskContract` | 一次委托的目标、输入、边界、权限和验收标准 |
| `AgentProvider` | 一类受支持 Agent 及其 Driver、识别规则和兼容策略 |
| `AgentInstallation` | 本机一个真实 Agent 安装实例及路径、版本和健康状态 |
| `AgentProfile` | 某个安装实例的运行偏好、权限与工作空间覆盖配置 |
| `CapabilityManifest` | 当前 Agent 版本经过探测后真实支持的标准与扩展能力 |
| `AgentSession` | 绑定工作对象、安装实例与工作目录的多轮会话 |
| `RepositoryBinding` | 服务、公司版本仓、个人 Fork、本地目录和版本的映射 |
| `EnvironmentSnapshot` | 某个时间点、某个环境内可复核的运行事实 |
| `Delegation` | 谁授权哪个 Agent 在什么范围内执行什么动作 |
| `AgentRun` | AgentSession 中一次可取消、审计并产生结果的执行 |
| `Artifact` | 补丁、报告、文档、合并请求等输入或产出 |
| `Evidence` | 测试、日志、快照、审批、回归等可验证事实 |
| `Decision` | 被接受或拒绝的选择、依据、责任人与影响 |
| `WorkflowInstance` | 工作对象当前流程、阶段、责任角色和门禁状态 |

## 五、权威来源原则

| 事实类型 | 权威来源 | Fouc 保存的内容 |
|---|---|---|
| 代码与提交 | Git / CodeHub | 仓库引用、Commit、Diff、工作区状态 |
| 问题与需求 | 问题管理系统 | ID、状态映射、必要快照、关系 |
| 运行状态 | 测试/客户环境、CMDB、可观测平台 | 查询引用、时间快照、脱敏证据 |
| 构建与测试 | CI/CD、测试平台 | Run ID、结果、日志引用、验收状态 |
| Agent 执行 | Fouc | TaskContract、调用记录、制品、成本、审批 |
| Agent 安装与凭据 | 用户机器上的原生安装与 Agent 凭据存储 | 路径、版本、能力、状态与配置引用，不复制长期凭据 |
| 文档与规范 | 文档/Wiki/仓库 | ACL 感知引用、版本、摘要 |

Fouc 不维护第二份完整代码、工单或文档。中央控制层只保存跨系统关系、必要快照、流程状态与验收证据。

## 六、远程环境接入

### 无代理模式

优先复用 SSH、WinRM、Kubernetes API、日志平台和可观测系统。适用于已有安全接入能力、无需额外部署组件的环境。

### 轻量 Relay 模式

当网络隔离、协议转换或审计要求无法由现有通道满足时，在远端部署 Fouc Relay。Relay 只负责：

- 身份认证与授权校验；
- 允许动作和命令白名单；
- 数据过滤、裁剪与脱敏；
- 结果流式传输；
- 操作审计与连接恢复。

Relay 不包含模型服务、Agent 推理、源码理解或长期模型凭据。

## 七、安全与治理底线

- 模型凭据默认只存在于本地可信执行环境或企业模型网关；
- Fouc 复用 Agent 原生认证，不读取、导入或复制其长期凭据；
- 发现 Agent 时必须验证实际可执行路径和身份，不能只信任同名命令；
- 安装、升级、卸载、修改原生配置必须由用户显式发起；
- 远程连接使用短期、最小权限凭据，并绑定人员、任务、环境和用途；
- 远程诊断默认只读，高风险动作分步授权且可随时吊销；
- Secret、Token、个人信息在进入模型上下文前识别和脱敏；
- 每次 Agent 行动记录请求人、责任人、执行 Agent、实际身份和授权来源；
- 重要制品使用版本或内容摘要固定，避免证据被静默覆盖；
- 不展示或持久化模型隐式思维链，只保留计划、结论、依据和制品；
- 团队策略优先于个人 Agent 配置，关键门禁不能由提示词绕过。

## 八、关键架构边界

- Fouc 拥有工作语义、流程、策略和证据，不拥有外部系统的全部内容；
- Agent Driver 与能力清单负责差异适配，领域模型不依赖 Agent 私有格式；
- 上层工作流不直接启动 CLI，必须通过本地 Agent 管理平面；
- Context Broker 只组装当前任务所需的最小上下文；
- 本地工作区和远程环境是两个独立信任域；
- 概率性的 Agent 结论不能直接改变确定性的流程与权限状态。
