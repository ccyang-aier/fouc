# Fouc 本机 Agent 发现与纳管实现设计

> 特性：V1 P0《本机 Agent 自动发现与统一纳管》（对应 P0 基础能力 F0，依赖 F1/F3/F4）。
> 前置阅读：[本地 Agent 发现与纳管设计](../local-agent-management.md)、[AionUi 架构与代码分析](./aionui-architecture-analysis.md)。
> 本文回答：架构怎么设计、哪些 AionUi 资产直接迁移、哪些必须按 Fouc 标准重写、按什么顺序实现。

## 〇、结论摘要

1. **协议基座选定 ACP（Agent Client Protocol）**。Fouc 首批三个 Agent 全部可用 ACP 纳管：OpenCode 原生 `opencode acp`，Claude Code 与 Codex 经官方维护的桥接包进入 ACP（`@agentclientprotocol/claude-agent-acp`、`@zed-industries/codex-acp`）。AionUi 用同一策略纳管了 17 个 Agent，充分验证了可行性。
2. **协议栈放在 Rust 侧，直接使用 ACP 官方 Rust SDK（`agent-client-protocol` crate，Zed 维护）**。Fouc 是 Tauri 应用，不需要像 AionUi 那样为 TS SDK 维护 Node sidecar；ACP over stdio（NDJSON JSON-RPC）由 Rust tokio 子进程直接承载。
3. **领域模型按 Fouc 规划落地，不照搬 AionUi**：`AgentProvider / AgentInstallation / AgentProfile / CapabilityManifest / AgentSession / AgentRun` 六对象 + SQLite 持久化 + 事件日志；AionUi 缺失的工作对象绑定、审计、风险分级审批、重启恢复按 Fouc 标准设计。
4. **从 AionUi 迁移四类资产**：内置 Agent 目录数据（17 条声明矩阵）、批量 PATH 检测算法、进程生命周期监督模式（4 信号 + stderr 环形缓冲 + 启动失败监视）、启动错误翻译模式表；外加一份跨平台环境坑位清单。代码级复用按 Apache-2.0 义务执行，其余为逻辑级重写（Rust）。
5. **实现分五个里程碑**：发现登记 → 探测与能力清单 → 会话与运行 → 事件流与审批 → 恢复与健壮化，每个里程碑可独立验证。

## 一、关键架构决策

### AD-1 协议基座：ACP，而非每个 CLI 一套私有适配

**决策**：统一 Agent Driver 的第一实现是 ACP Driver；每个受管 Agent 在 Provider 目录中只是一条声明（命令、ACP 启用方式、桥接包、认证要求），不为任何 Agent 解析私有 stdout 格式。

**理由**：

- AionUi 以此模式纳管 17 个 Agent，新增 Agent 的边际成本是一行目录声明，验证了扩展性；
- ACP 原生提供 Fouc L3 所需的全部结构化能力：流式消息、工具调用事件（含 diff）、计划、权限审批（四选项语义）、token 用量、上下文用量、会话恢复（`session/load`）；
- 首批三家的支持现状（2026-08，以探测结果为准）：

| Agent | ACP 接入方式 | 说明 |
|---|---|---|
| OpenCode | 原生：`opencode acp` | 无桥、无 Node 依赖 |
| Claude Code | 桥：`npx @agentclientprotocol/claude-agent-acp@<pin>` | ACP 官方维护的桥；探测时同时探测 CLI 本体与桥可用性 |
| Codex | 桥：`npx @zed-industries/codex-acp@<pin>` | Zed 维护；Windows/Linux 优先平台专用子包（免 JS 启动开销） |

**边界**：ACP 是 V1 的唯一 Driver 实现，但 Driver 接口按多协议设计（AionUi 同时管理 acp/remote/aionrs 等 5 种 kind 的先例），为 V2 的远程 Agent、A2A 端点保留扩展位。Claude 的非标准会话分叉（`_meta.claudeCode.options.resume`）这类缝隙通过 Driver 的 `extMethod` 通道容纳，不污染统一模型。

### AD-2 协议栈：Rust 侧官方 SDK，不引入 Node sidecar

**决策**：ACP client 在 Tauri Rust 核心内实现，使用官方 Rust SDK `agent-client-protocol`（Zed 编辑器同款，同时提供 `agent-client-protocol-schema` 强类型线格式 crate）。子进程 spawn、stdio 读写、NDJSON 分帧由 tokio 承载。

**对比过的替代方案**：

| 方案 | 评价 |
|---|---|
| Rust + 官方 SDK（选定） | 无额外运行时；类型安全；SDK 由 Zed 生产环境锤炼；与 Tauri 进程模型天然契合 |
| Node sidecar + TS SDK（AionUi 1.x 路线） | 需要打包/管理 Node 运行时、sidecar 生命周期、双进程日志——AionUi 2.x 把后端整体迁去 Rust 正是摆脱这类负担 |
| 手写 JSON-RPC | 协议面约 15 个方法，可行但无收益；SDK 已处理版本协商、能力解析、扩展方法 |

**注意**：桥接包（claude-agent-acp / codex-acp）本身是 Node 包，经 `npx` 启动，因此**用户机器需要 Node 或 Bun**（OpenCode 不需要）。Fouc V1 的处理：探测阶段检测 `node`/`bun`/`npx` 可用性，缺失时把相关 Agent 标为 `needs_runtime` 状态并给出安装引导；不做静默安装。版本固定的桥包由 Fouc 显式管理缓存（见 AD-3）。

### AD-3 桥接包策略：固定版本、本地缓存、显式安装

AionUi 的 npx 桥依赖隐式网络拉取（`--prefer-offline` 优先、失败回源），并为此打了大量补丁（bunx 缓存损坏清理、Defender EPERM 重试、缓存目录重定向）。Fouc 收敛为确定性策略：

- 桥包版本在 Provider 目录中**固定**（`bridgeVersion`），升级随 Fouc 版本走，属于显式变更；
- 首次使用某桥时执行一次**显式安装**：校验来源（npm registry + integrity）后安装到 `~/<userData>/runtime/bridges/<pkg>@<version>/`，之后一律离线启动；
- 安装动作在 UI 中可见、可取消，失败给出错误码与修复引导；不做后台静默拉取；
- 启动命令组装为 `<node> <bridge-cache-dir>/bin/...`（或 npx 指向缓存），PATH 上没有 npx 也可运行。

### AD-4 Provider 目录：声明式、代码内、可被用户覆盖

内置 Provider 目录是 Rust 源码内的静态表（等价于 AionUi 的 `ACP_BACKENDS_ALL`），V1 首批只启用三条（codex/claude/opencode），但**目录结构直接容纳 AionUi 已验证的其余 14 条**，V1.1+ 扩容只是加数据不加架构。每条声明：

```rust
struct ProviderSpec {
    id: ProviderId,              // "codex" | "claude-code" | "opencode"
    name: &'static str,
    cli_command: &'static str,   // PATH 检测用的命令名
    acp_launch: AcpLaunch,       // Native { subcommand } | Bridge { package, version, platform_pkgs }
    auth_required: bool,         // 握手后结合 auth_methods 判定 needs_auth
    min_protocol_version: u32,   // 兼容范围
    skills_dir: Option<&'static str>,   // ".codex/skills" 等原生技能目录
    notes: &'static str,         // 兼容性备注（如 cursor 的命令名歧义教训）
}
```

用户覆盖（`AgentProfile` 级）允许改路径、追加参数、注入白名单环境变量；覆盖存在与否在 UI 显式可见（借鉴 AionUi 的 `has_command_override`）。

### AD-5 能力清单：由探测握手产生，禁止静态假设

`CapabilityManifest` 的唯一生成路径：**probe 阶段真实 spawn 一次 CLI → 完成 ACP `initialize`（+可选 `session/new` 后立即关闭）→ 从响应映射能力**。这与 Fouc 文档要求及 AionUi 2.x 的 `handshake` 留存一致。映射规则：

| ACP 握手字段 | CapabilityManifest 字段 |
|---|---|
| `agentInfo.version` | `version`（同时驱动兼容范围判定） |
| `protocolVersion` | `protocolVersion`，不在兼容范围 → `incompatible` |
| `capabilities.loadSession` | `session.resume` |
| `capabilities.promptCapabilities` | `input.image / audio / embeddedContext` |
| `capabilities.mcpCapabilities` | `extensions.mcp.{stdio,http,sse}` |
| `capabilities.sessionCapabilities` | `session.fork / list / close` |
| `auth_methods[]` | `auth.methods`；为空且 `auth_required` → `needs_auth` |
| `session/new` 的 `configOptions/modes/models` | `controls.*`（模型选择、权限模式、配置项） |

Driver 再叠加 Provider 级静态能力（如 OpenCode 支持原生 acp 无需桥），最终产出 L0–L3 层级判定（见 §6）。

### AD-6 AionUi 资产处置原则

- **数据/算法/模式 → 迁移**（Apache-2.0，保留版权与许可标注）；
- **Electron/TS 基础设施 → 不迁**（Fouc 是 Tauri/Rust，无 Electron IPC、无渲染进程桥）；
- **聊天中心模型 → 不迁**（Fouc 是 WorkObject/AgentRun 中心，事件直接落 F4 事件存储）；
- **自愈式重试 → 收敛**（网络拉取、缓存清理、重装类动作全部改为显式用户操作）。

## 二、总体架构

### 2.1 模块布局（`src-tauri/src/agents/`）

```text
src-tauri/src/agents/
├── mod.rs              # 对外门面：AgentControlPlane
├── provider.rs         # ProviderSpec 静态目录 + 用户覆盖合并
├── discovery.rs        # 发现服务：候选收集 + 批量 PATH 检测 + 常见安装位置
├── probe.rs            # 探测：身份确认、版本解析、ACP 握手、健康检查
├── capability.rs       # CapabilityManifest 生成与 L0-L3 判定
├── registry.rs         # AgentInstallation/AgentProfile 持久化与状态机
├── driver/
│   ├── mod.rs          # AgentDriver trait + DriverRouter
│   └── acp/
│       ├── connection.rs   # 单个子进程 + ACP 连接的所有者（迁移 ProcessAcpClient 模式）
│       ├── transport.rs    # tokio child stdio ↔ NDJSON 帧
│       ├── events.rs       # sessionUpdate → Fouc 标准事件映射
│       └── auth.rs         # AuthNegotiator 对应物（env 白名单注入 + methodId 协商）
├── supervisor.rs       # 会话池、并发/超时/资源租约、空闲回收、优雅取消、遗留进程处理
├── bridge_runtime.rs   # 桥接包缓存管理（显式安装/校验/定位）
└── store.rs            # SQLite 访问（表见 §3）
```

上层（Work Room、编排层）只依赖 `AgentControlPlane` 暴露的命令与事件，不接触进程与协议细节——对应 Fouc 架构文档"上层工作流不得直接拼接 CLI 命令"的红线。

### 2.2 与 Fouc 其他 P0 能力的边界

```text
┌────────────────────────── Next.js 渲染进程 ──────────────────────────┐
│  Agent 资产页 / 详情页 / Work Room 执行器选择 / 运行控制区            │
└───────────────────────────────┬──────────────────────────────────────┘
                        Tauri command / event
┌───────────────────────────────▼──────────────────────────────────────┐
│  AgentControlPlane（本特性）                                         │
│  discovery · probe · capability · registry · driver/acp · supervisor │
└──────┬──────────────────────────────────────────────┬───────────────┘
       │ 进程 spawn/stdio（经由 F1 执行内核统一入口）  │ 状态与事件
┌──────▼──────────┐                          ┌─────────▼───────────────┐
│ Agent 子进程     │                          │ F4 持久化运行时          │
│ opencode acp    │                          │ SQLite + 事件日志        │
│ node bridge→codex/claude                   │ AgentSession/AgentRun    │
└─────────────────┘                          └─────────────────────────┘
```

- **F1 执行内核**：Agent 子进程必须经 F1 的统一 spawn 入口创建（等价 AionCore 的 `Builder::agent`：kill_on_drop、环境清洗、工作目录固定），Agent Driver 不自建进程管理；本特性向 F1 提出 `longLivedCli` 构造器需求；
- **F3 策略中心**：审批请求（`request_permission`）经 F3 风险分级决策（见 §8），Agent Driver 只负责协议往返；
- **F4 持久化**：所有状态变更（installation 状态、session/run 生命周期、事件、审批）追加写入 F4 事件日志，UI 状态可由持久事实重建。

## 三、领域对象与持久化

### 3.1 对象模型（对齐 local-agent-management.md §三）

| 对象 | 职责 | 与 AionUi 概念映射 |
|---|---|---|
| `AgentProvider` | 一类 Agent 产品 + Driver + 识别规则 + 兼容策略 | `ACP_BACKENDS_ALL` 条目 + `agent_source: builtin` |
| `AgentInstallation` | 本机一个真实安装实例（路径、版本、健康、状态） | `DetectedAgent` + `AgentMetadata` 的状态/快照字段 |
| `AgentProfile` | 安装实例上的运行偏好（模型、模式、参数、env 白名单、工作空间） | `AgentMetadata` 的 overrides 部分 |
| `CapabilityManifest` | 探测产生的真实能力清单 + L0–L3 层级 | `AgentHandshake`（原样留存握手指纹） |
| `AgentSession` | 多轮会话，绑定 WorkObject、安装实例、工作目录、原生 sessionId | `AcpSession`（但增加 Fouc 绑定关系） |
| `AgentRun` | 一次可取消、可审计的执行（prompt 级） | 无对应（AionUi 无 Run 抽象）——Fouc 新增 |

### 3.2 SQLite 表（F4 之内）

```sql
agent_installation (
  id TEXT PRIMARY KEY,            -- 稳定 id：provider + 归一化路径摘要
  provider_id TEXT NOT NULL,
  executable_path TEXT NOT NULL,  -- 解析后的绝对路径
  source TEXT NOT NULL,           -- path | known_location | user_added | package_manager
  version TEXT,                   -- probe 得到
  status TEXT NOT NULL,           -- ready|needs_auth|needs_runtime|incompatible|
                                  -- unhealthy|disabled|missing|unchecked
  capability_manifest TEXT,       -- JSON（CapabilityManifest 全量）
  last_probe_at INTEGER, last_probe_kind TEXT,   -- startup|scheduled|manual|session
  last_error_code TEXT, last_error_message TEXT, last_error_guidance TEXT,
  last_probe_latency_ms INTEGER,
  enabled INTEGER DEFAULT 1, is_default INTEGER DEFAULT 0,
  created_at INTEGER, updated_at INTEGER
);

agent_profile (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES agent_installation(id),
  name TEXT NOT NULL,
  default_model TEXT, permission_mode TEXT, extra_args TEXT,  -- JSON array
  env_allowlist TEXT,            -- JSON array：允许注入的环境变量名
  workspace_scope TEXT,          -- 允许使用的工作空间根
  is_active INTEGER DEFAULT 0
);

agent_session (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  profile_id TEXT,
  work_object_id TEXT,           -- F4 WorkObject 外键（可为空：纳管自测会话）
  work_dir TEXT NOT NULL,
  native_session_id TEXT,        -- ACP session/new 返回
  status TEXT NOT NULL,          -- idle|active|prompting|suspended|ended|unrecoverable
  created_at INTEGER, last_active_at INTEGER, ended_at INTEGER, end_reason TEXT
);

agent_run (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL,          -- 会话内序号
  task_contract_ref TEXT,        -- F5 ContextRef
  status TEXT NOT NULL,          -- queued|running|waiting_input|waiting_approval|
                                 -- cancelling|completed|failed|cancelled
  started_at INTEGER, ended_at INTEGER, exit_info TEXT,   -- JSON AgentExitInfo
  stop_reason TEXT, usage TEXT   -- ACP promptResponse 原样
);

agent_event (                    -- 追加式事件日志（F4 统一事件存储的 agent 域分区）
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT, run_id TEXT, installation_id TEXT,
  seq_in_run INTEGER,            -- run 内单调序号，重建流式视图用
  type TEXT NOT NULL,            -- 标准事件类型（§7.3）
  payload TEXT NOT NULL,         -- JSON
  created_at INTEGER NOT NULL
);
```

索引：`(session_id, seq_in_run)`、`(installation_id, last_probe_at)`、`(type, created_at)`。事件中的 `raw_output` 类大字段（工具输出、diff 正文）超出阈值时落制品存储，行内只留引用（借鉴 AionCore 的工具输出清洗：大 base64/二进制不进 WS/SQLite，只留 `saved_path`）。

## 四、发现服务设计

### 4.1 候选来源与优先级（按 local-agent-management.md §四）

1. 已登记 installation 的保存路径（优先核实，`missing` 语义来自这里）；
2. 进程可见 `PATH`（批量检测）；
3. 平台常见安装位置（V1 最小集）：
   - Windows：`%USERPROFILE%\.local\bin`、`%APPDATA%\npm`、`%LOCALAPPDATA%\Programs`、scoop/winget shim 目录；
   - macOS：`/usr/local/bin`、`/opt/homebrew/bin`、`~/.local/bin`；
   - Linux：`~/.local/bin`、`/usr/local/bin`；
4. 用户手工添加的可执行文件（文件选择器，最优先于 2/3 的覆盖）。

不做全盘扫描；只对目录内与 Provider 目录 `cli_command` 同名的条目做 `stat`。

### 4.2 批量 PATH 检测（迁移 AionUi AcpDetector 算法）

- 命令名先过 `/^[a-zA-Z0-9_.-]+$/` 白名单（防注入），其余拒绝并记诊断；
- POSIX：一次 login shell 执行 `command -v 'a' && echo 'a'; command -v 'b' …`（3s 超时）；
- Windows：并行 `where <cmd>`（3s）失败回退 PowerShell `Get-Command`（5s）；
- **GUI 环境 PATH 增强**：Tauri 启动时合并 login shell PATH（Rust 侧等价 AionCore 的 main() 阶段 PATH 增强），检测结果才可信；
- 结果缓存本次探测周期，刷新入口（手动刷新、设置变化、安装器返回）显式触发。

### 4.3 与 AionUi 的差异（安全收紧）

AionUi 检测到命令名存在即 `available: true`（cursor 的 `which agent` 歧义它自己也承认）。Fouc 收紧为：**PATH 命中只产生"候选"，必须经 §5 探测确认身份后才进入 `ready`**；探测前 UI 显示 `unchecked`。

## 五、探测、连接测试与健康检查

### 5.1 probe 流程（身份确认，无持久副作用）

```text
probe(installation):
 1. 解析最终可执行路径（符号链接/Windows shim 归一化），记录真实二进制与目录
 2. 无副作用版本探测：运行 <cli> --version（或 Provider 声明的版本命令，5s 超时）
    - 输出必须匹配 Provider 的版本正则，否则 candidate_rejected（防止同名伪 CLI）
 3. 组装 ACP 启动命令（Native 子命令 或 已安装桥），经 F1 执行内核 spawn
 4. ACP initialize 握手（10s 超时）：
    - 失败分类见 5.2；成功则记录 agentInfo、protocolVersion、auth_methods、capabilities
 5. （可选）session/new → 立即 close，采集 configOptions/modes/models
 6. 优雅终止子进程（stdin close → grace 100ms → kill）
 7. 生成 CapabilityManifest，判定 L 层与状态，写 installation + 事件日志
```

### 5.2 两阶段失败分类（迁移 AionUi try-connect 语义）

| 阶段 | 失败 | 错误码 | 修复引导 |
|---|---|---|---|
| CLI | spawn 失败 / ENOENT / 版本命令失败 | `command_not_found` / `version_probe_failed` | 安装 CLI 或修正路径 |
| CLI | 版本输出不匹配 Provider 正则 | `identity_mismatch` | 该文件不是预期的 Agent |
| CLI | 桥包未安装且无 Node/Bun | `runtime_missing` / `bridge_missing` | 安装 Node/Bun 或执行桥安装 |
| 协议 | initialize 超时 / 进程早退（含退出码 0 无输出的"不支持 ACP"形态） | `acp_init_failed` | 升级 CLI 到支持 ACP 的版本 |
| 协议 | protocolVersion 不在兼容范围 | `incompatible_version` | 升级 CLI 或等待 Fouc 适配 |
| 认证 | 握手成功但 auth_required 且无可用认证 | `auth_required` | 进入 Agent 原生认证引导（不索取密钥） |

启动错误消息翻译模式表整体迁移自 AionUi `buildStartupErrorMessage`（"command not found"族、"error loading config"族、退出码 0 无 stderr = 不支持 ACP 模式）。

### 5.3 健康检查时机与节流

迁移 AionUi 的四时机模型：`startup`（应用启动后后台刷新已登记项）、`manual`（资产页刷新/诊断按钮）、`session`（创建会话前快速复核：仅存在性 + 版本命令，不重复完整握手）、`scheduled`（V1 可选，默认关闭）。节流：同一 installation 完整 probe 间隔下限 5 分钟，`session` 级轻检查不受限。

## 六、能力清单与适配层级

CapabilityManifest（JSON 落库，UI 直接消费）：

```rust
struct CapabilityManifest {
    adapter_level: AdapterLevel,        // L0..L3
    protocol: ProtocolInfo,             // acp, protocol_version
    version: String,
    session: SessionCaps,               // resume, fork, list, close, multi_turn
    input: InputCaps,                   // image, audio, embedded_context
    controls: ControlCaps,              // models[], modes[], config_options[]
    extensions: ExtensionCaps,          // mcp{stdio,http,sse}, skills_dir
    events: EventCaps,                  // 支持的标准事件类型集合（§7.3）
    auth: AuthCaps,                     // methods[], needs_auth
    probed_at: i64,
    fingerprint: String,                // (version, protocol_version, caps) 摘要，检测协议漂移
}
```

层级判定（Driver 规则 + 握手结果）：

| 层级 | 判定 |
|---|---|
| L0 发现 | 路径与身份确认，但版本/协议探测失败——只可登记与诊断 |
| L1 进程 | spawn 成功且 initialize 成功，但不支持 `session/load`——一次性任务 |
| L2 会话 | L1 + `capabilities.loadSession == true`——多轮、可恢复（首批三家必须达到） |
| L3 结构化 | L2 + tool_call 事件 + request_permission + usage 上报——完整编排与审批 |

`fingerprint` 变化（Agent 升级导致事件格式变化）时，Driver 保守降级：停用结构化自动化，标记 `incompatible` 待重新探测——对应验收标准"Agent 升级导致事件格式变化时标记不兼容，不误判成功"。

## 七、Agent Driver 与统一事件流

### 7.1 Driver trait

```rust
#[async_trait]
pub trait AgentDriver: Send + Sync {
    fn provider(&self) -> &ProviderSpec;
    /// 无副作用探测（发现后身份确认）
    async fn probe(&self, installation: &AgentInstallation) -> ProbeReport;
    /// 创建受管会话（spawn + initialize + session/new）
    async fn create_session(&self, input: CreateSessionInput) -> Result<AgentSession>;
    /// 会话内下发一次任务（AgentRun 生命周期由 supervisor 管理）
    async fn send(&self, run: &AgentRun, input: RunInput) -> Result<()>;
    /// 事件流（后台 task 持续产出标准事件，写入 F4）
    fn subscribe(&self, session_id: &str) -> EventStream;
    async fn cancel(&self, run_id: &str) -> Result<()>;        // 优雅取消
    async fn resume(&self, session_id: &str) -> Result<AgentSession>;
    async fn terminate(&self, session_id: &str) -> Result<()>; // 终止会话及子进程
    async fn diagnose(&self, session_id: &str) -> Diagnostics; // 原始 stderr/exit/日志引用
    /// ACP 扩展通道（Claude fork 等私有缝隙）
    async fn ext(&self, session_id: &str, method: &str, params: Json) -> Result<Json>;
}
```

上层仅依赖 trait + `DriverRouter::route(installation_id)`。

### 7.2 AcpConnection（迁移 ProcessAcpClient 模式到 Rust）

一个连接 = 一个子进程 + 一个 ACP 会话组，工程要求逐条对应 AionUi 已验证的模式：

- **4 信号退出检测**：tokio child `wait`、stdout EOF、SDK 连接 abort、显式 close；first-write-wins 记录 `AgentExitInfo { exit_code, signal, reason, stderr_tail, unexpected_during_prompt }`；
- **stderr 环形缓冲 8KB**：启动即捕获，随退出信息带出，落 `agent_run.exit_info`；
- **启动失败监视**：`tokio::select!` 上 `initialize` vs 进程退出，SDK 的笼统断连错误归一化为带 stderr/退出码的 `AgentStartupError`；
- **pending 请求注册表**：断连时全部 reject 为 `AgentDisconnectedError`，运行中 Run 标记 `failed` 并保留已产出事件；
- **三阶段关闭**：`session/cancel`（若在 prompt 中）→ stdin close + grace → kill（进程组）。

### 7.3 标准事件映射（ACP sessionUpdate → Fouc 事件）

| ACP update | Fouc 事件 | 备注 |
|---|---|---|
| `user_message_chunk` | `message.delta`（role=user） | 回显用户输入 |
| `agent_message_chunk` | `message.delta`（role=agent） | 流式正文 |
| `agent_thought_chunk` | `thought.delta` | 仅存摘要级；不持久化隐式思维链（安全底线），UI 可选显示 |
| `tool_call` / `tool_call_update` | `tool.started` / `tool.completed` / `tool.failed` | content 含 diff 时发 `artifact.changed` |
| `plan` | `plan.updated` | 条目级状态 |
| `current_mode_update` 等 | `control.updated` | 模式/模型/配置变化 |
| promptResponse `stopReason`/`usage` | `run.completed` 附带 | 用量入 Run |
| `session/request_permission`（反向请求） | `approval.required` → 审批后回写选项 | 见 §8 |
| 连接生命周期 | `session.started/ended`、`run.started/failed/cancelled` | Driver 合成 |

原生协议不提供的事件类型，Driver 在 CapabilityManifest 的 `events` 中声明不支持，UI 相应降级（不猜测）。

## 八、审批与权限衔接（F3）

`request_permission` 到达后的决策链（替代 AionUi 的 YOLO 三级模式，但保留其审批缓存思想）：

```text
approval.required
  → F3 策略评估：
      工具/命令风险 × Profile 权限模式 × Workspace 策略
      ├─ read 类且策略允许 → 自动 allow_once（缓存决策）
      ├─ 白名单（kind+title+command/path 键，LRU 500，仅 allow_always 入缓存）→ 自动放行
      ├─ 超出自动范围 → Work Room 审批卡片（四选项语义原样映射），等待用户
      └─ 策略禁止（如 write-remote 未授权）→ 自动 reject_once + 记录
  → approval.resolved 事件 + 回写 ACP outcome
```

- ACP 的 `allow_always` 语义映射为 Fouc 的 scoped delegation（绑定 installation + 命令指纹 + 有效期），存 F3，可吊销；
- `auth_required`（Agent 层登录）与工具审批是两件事：前者引导进入 Agent 原生认证（`claude login` 等由用户在终端完成，Fouc 只检测状态），后者走上述决策链。

## 九、会话监督与生命周期（supervisor.rs）

- **会话池**：`DashMap<SessionId, SupervisedSession>`，含连接句柄、状态机（`idle/active/prompting/cancelling/suspended/ended/unrecoverable`）、`last_active_at`；
- **空闲回收**：默认 10 分钟空闲 → `session/close` + 优雅退出，installation 侧记录；回收后新消息自动走 `resume`（`session/load`），不可恢复则显式建新会话并生成上下文交接说明；
- **取消语义**：`run.cancel` → ACP `cancel` → 2s 内未结束提示用户"进程仍在运行"，提供强制终止（UI 区分"请求取消"与"进程已结束"）；
- **并发与资源**：每 installation 默认并发 Run 上限（V1 = 1）、全局子进程上限、per-run 超时（Profile 可配，默认无上限但空闲 watchdog 兜底）；
- **遗留进程处理**：启动时扫描 `agent_run.status IN (running, waiting_*)` 且无存活连接的记录 → 标记 `failed`（`orphaned`），并按 PID/启动时间核对进程表清理孤儿（AionUi 2.x AionCore 的 startup cleanup 同款语义）；
- **工作目录隔离**：`create_session` 必须携带 WorkObject 绑定的隔离工作区路径（F2 worktree），Driver 拒绝默认 cwd 的写入类会话。

## 十、安全边界（对照 architecture-and-security.md §七）

- 凭据：不读取/复制 Agent 原生凭据存储；认证引导走原生流程；Profile 只保存环境变量**名**白名单，值在会话创建时从系统环境读取注入，不落库不进日志（AionUi AuthNegotiator 的"秘密只走子进程 env"原则）；
- 环境变量：子进程默认继承白名单化的最小集（PATH/HOME/TERM/Agent 认证相关变量），Electron 时代的 NODE_OPTIONS/npm_* 清洗经验对 Rust 侧同样适用（桥进程仍是 Node）；
- 探测只读元数据，不执行来源不明候选；身份正则不过即拒绝；
- 桥包安装显式、版本固定、完整性校验；
- 事件日志中的命令与参数脱敏（密钥类参数遮蔽），`diagnose` 输出经同一脱敏器。

## 十一、前端设计（Next.js 渲染进程）

V1 交付四个界面（对齐 local-agent-management.md §九）：

1. **Agent 资产页**：Provider 分组的 installation 列表——名称、版本、路径、状态徽章（含原因与修复入口，迁移 AionUi 错误码 → i18n 模板体系）、适配层级（L0–L3 徽章）、默认标记、最近探测时间与耗时；操作：刷新发现、添加路径、设为默认、启用/停用、诊断、解除纳管、打开原生终端/配置目录。
2. **Agent 详情页**：CapabilityManifest 可视化（会话/输入/控制/扩展/事件分组）、Profiles 管理（模型、权限模式、env 白名单、工作空间）、健康历史（最近探测记录、错误详情、延迟）、原生配置位置引用。
3. **连接测试视图**（添加自定义 Agent / 桥安装向导内嵌）：两阶段进度（CLI 检查 → ACP 握手），失败定位到阶段与错误码，给出下一步动作。
4. **Work Room 执行器选择**：按 TaskContract 需求过滤可用 Agent（能力 + 状态 + 工作空间），显示能力差异提示（如"L1：本 Agent 不支持会话恢复，任务不可暂停"）。

数据通道：Tauri command（查询/操作）+ Tauri event（`agent://installation-changed`、`agent://event/<run_id>` 流式推送）。

## 十二、从 AionUi 迁移的资产清单

代码级复用（保留 `Copyright 2025 AionUi (aionui.com)` 头 + Apache-2.0 标注 + NOTICE）：

| # | AionUi 源（1.x 归档 tag `archive/main-before-backend-migration-2026-05-25`） | Fouc 去处 | 形态 |
|---|---|---|---|
| 1 | `src/common/types/acpTypes.ts` 的 `ACP_BACKENDS_ALL`（17 条 Agent 声明矩阵） | `agents/provider.rs` 静态目录 | 数据转写（Rust 表），V1 只启用 3 条 |
| 2 | `src/process/agent/acp/AcpDetector.ts` 批量检测算法（POSIX 单 shell、Windows 双回退、注入过滤） | `agents/discovery.rs` | 逻辑重写（Rust） |
| 3 | `AcpConnection.buildStartupErrorMessage` 错误翻译模式 | `agents/probe.rs` 错误分类 | 模式迁移（正则族） |
| 4 | `src/process/acp/infra/ProcessAcpClient.ts` 生命周期模式（4 信号、stderr 环形缓冲、启动竞态、pending 拒绝、三阶段关闭） | `agents/driver/acp/connection.rs` | 逻辑重写（tokio） |
| 5 | `src/process/acp/session/PermissionResolver.ts` 审批缓存（键构造：kind+title+command/path；仅 allow_always 入缓存；LRU 500） | F3 审批决策链的缓存层 | 逻辑重写 |
| 6 | `src/process/acp/session/AuthNegotiator.ts`（env_var 方法匹配、失败即 AUTH_REQUIRED retryable） | `agents/driver/acp/auth.rs` | 逻辑重写 |
| 7 | try-connect 两阶段契约与错误码语义（2.x `ipcBridge` 契约 + 2.x `AgentMetadata` 错误码体系） | `agents/probe.rs` + 前端 i18n 模板 | 契约采纳 |

逻辑参考（不迁代码，规避不适用部分）：

- AcpRegistry 的互斥刷新队列与分区缓存模式（registry.rs）；
- AcpRuntime 的状态机与空闲回收参数（supervisor.rs，超时从 5min 调至 10min 以适配长研发任务）；
- AionCore 的 PATH 增强时机（main 阶段）、`Builder::agent/clean_cli` 双构造器、工具输出大字段清洗；
- 环境坑位清单（bun/npm/Defender/detached）——Rust 侧按需取用，桥缓存策略被 AD-3 取代大半。

明确不迁移：Electron IPC/bridge 层、聊天消息模型（chatLib）、YOLO 全局自动批准、Hub 扩展市场（V2 再议）、远程 Agent（openclaw/zerocaw）与内置引擎（aionrs）相关代码。

## 十三、实现里程碑

| 里程碑 | 内容 | 验证方式 |
|---|---|---|
| M1 发现与登记 | provider.rs 目录（3 家）、discovery.rs 批量检测、registry.rs 持久化、资产页列表 + 添加路径 + 启停 | 装有 0/1/2/3 个 Agent 的机器上，发现结果准确、`missing`/`unchecked` 语义正确 |
| M2 探测与能力 | probe.rs 全流程、两阶段失败分类、CapabilityManifest 生成与落库、健康检查四时机、详情页能力视图 | 每家 Agent 的真实安装上握手成功；伪造同名二进制被 `identity_mismatch` 拒绝；版本不兼容场景标记正确 |
| M3 会话与运行 | ACP Driver（connection/transport）、create/send/cancel/terminate、agent_session/agent_run 落库、运行控制区 UI | 三家 Agent 各完成一次真实任务：创建会话→下发→流式→取消→终止；崩溃场景保留诊断 |
| M4 事件与审批 | events.rs 标准事件映射、事件日志、approval 决策链（F3 接入）、审批卡片 UI | 工具审批全链路（自动/缓存/人工/策略拒绝四路径）；事件流可重放 |
| M5 恢复与健壮 | resume/suspend、空闲回收、遗留进程清理、指纹漂移降级、Fouc 重启恢复 | 重启 Fouc 后会话可恢复或明确不可恢复；Agent 升级后漂移被识别 |

每个里程碑完成即过对应验收场景（local-agent-management.md §十二），全部通过后更新 F0 状态。

## 十四、验收标准对照

| V1 验收标准（core-features.md） | 本设计的落实点 |
|---|---|
| 自动发现三家 CLI 并准确展示路径、版本、健康 | §4 发现 + §5 探测 + §11 资产页 |
| 基线操作：创建会话/下发/流式/追加/取消/结束 | §7 Driver + §9 supervisor |
| 不支持的操作明确降级 | §6 CapabilityManifest.events + 执行器选择页能力差异提示 |
| 崩溃/退出/协议异常可识别并保留诊断 | §7.2 退出信息 + stderr 缓冲 + orphaned 处理 |
| 不复制凭据、不破坏配置、不静默升级 | §10 安全边界 + AD-3 显式桥安装 |
| 操作关联用户/工作对象/工作目录/权限/审计 | §3.1 对象绑定 + 事件日志 + §8 审批链 |

## 十五、风险与开放问题

1. **桥接包的 Node 依赖**：无 Node 用户纳管 Codex/Claude 的体验断裂。缓解：`needs_runtime` 状态 + 安装引导；中期评估捆绑最小 Node 运行时（AionUi/AionCore 已有成熟先例可参考）。
2. **Claude Code 原生 ACP 进展**：若官方提供原生 ACP 模式（免桥），Provider 目录切一行声明即可，探测逻辑天然支持（优先原生、桥兜底）。保持跟踪。
3. **ACP unstable 方法**（set_model/close/fork）跨 Agent 行为差异：CapabilityManifest 已声明，UI 按 Agent 差异呈现，不做统一伪装。
4. **Windows shim 解析**（npm .cmd、pwsh shim）多层包装导致真实二进制定位复杂：M1 里做归一化专项验证（`where` 结果 + shim 内容解析）。
5. **首次完整探测的耗时**（桥冷启动 + 握手）：启动健康检查放后台、资产页异步渐进展示，避免阻塞首屏。

## 参考

- AionUi 仓库：`opensource/AionUi`（本仓库内，2.2.0）；1.x 实现见 git tag `archive/main-before-backend-migration-2026-05-25`
- AionCore：github.com/iOfficeAI/AionCore（Rust 后端，Apache-2.0）
- ACP 官方：[agentclientprotocol.com](https://agentclientprotocol.com/)、[Rust SDK](https://agentclientprotocol.com/libraries/rust)、[crates.io/agent-client-protocol](https://crates.io/crates/agent-client-protocol)
