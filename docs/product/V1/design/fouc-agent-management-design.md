# Fouc 本机 Agent 发现与纳管实现设计

> 特性：V1 P0《本机 Agent 自动发现与统一纳管》（对应 P0 基础能力 F0，依赖 F1/F3/F4）。
> 前置阅读：[本地 Agent 发现与纳管设计](../local-agent-management.md)、[AionUi 架构与代码分析](./aionui-architecture-analysis.md)。
> 本文回答：架构怎么设计、哪些 AionUi/AionCore 资产直接迁移、哪些必须按 Fouc 标准重写、按什么顺序实现。

## 〇、结论摘要

1. **协议基座选定 ACP（Agent Client Protocol）**。Fouc 首批三个 Agent 全部可用 ACP 纳管：OpenCode 原生 `opencode acp`，Claude Code 与 Codex 经官方维护的桥接包进入 ACP。AionUi 用同一策略纳管了 17 个 Agent，充分验证了可行性。
2. **后端为独立 TypeScript 进程（sidecar），使用官方 TS SDK（`@agentclientprotocol/sdk`）**。进程拓扑为"Next.js 前端（Tauri WebView）＋ TS 后端进程 ＋ Rust 薄壳"：领域逻辑全部在 TS（可读、可审、可维护），Rust 壳只负责窗口、系统能力桥与后端进程看护。后端运行时选定 Bun（开发即用、分发单文件、与桥接运行时同栈）。
3. **领域模型按 Fouc 规划落地**：`AgentProvider / AgentInstallation / AgentProfile / CapabilityManifest / AgentSession / AgentRun` 六对象 + SQLite 持久化 + 事件日志；AionUi 缺失的工作对象绑定、审计、风险分级审批、重启恢复按 Fouc 标准设计。
4. **分层迁移策略**：实现逻辑以 AionUi 1.x（TS，同语言同 SDK，可直接移植）为主参考；工程策略与坑位解法以 AionCore（Rust，最新踩坑产出）为权威参照——bun x 桥启动、双预算探测、registry 锁与缓存自修复、行为策略目录化。代码级复用按 Apache-2.0 义务执行。
5. **实现分六个里程碑**：M0 后端骨架（sidecar 拉起/健康/鉴权/共享契约）→ M1 发现登记 → M2 探测与能力清单 → M3 会话与运行 → M4 事件流与审批 → M5 恢复与健壮化，每个里程碑可独立验证。

## 一、关键架构决策

### AD-1 协议基座：ACP，而非每个 CLI 一套私有适配

**决策**：统一 Agent Driver 的第一实现是 ACP Driver；每个受管 Agent 在 Provider 目录中只是一条声明（命令、ACP 启用方式、桥接包、认证要求），不为任何 Agent 解析私有 stdout 格式。

**理由**：

- AionUi 以此模式纳管 17 个 Agent，新增 Agent 的边际成本是一行目录声明，验证了扩展性；
- ACP 原生提供 Fouc L3 所需的全部结构化能力：流式消息、工具调用事件（含 diff）、计划、权限审批（四选项语义）、token 用量、上下文用量、会话恢复（`session/load`）；
- 首批三家的支持现状（2026-08，以探测结果为准）：

| Agent | ACP 接入方式 | AionCore 目录中的启动行 |
|---|---|---|
| OpenCode | 原生子命令 | `opencode acp` |
| Claude Code | 桥 | `bun x --bun @agentclientprotocol/claude-agent-acp@0.29.2` |
| Codex | 桥 | `bun x --bun @zed-industries/codex-acp@0.9.5` |

**边界**：ACP 是 V1 的唯一 Driver 实现，但 Driver 接口按多协议设计（AionUi 同时管理 acp/remote/aionrs 等 5 种 kind 的先例），为 V2 的远程 Agent、A2A 端点保留扩展位。Claude 的非标准缝隙（会话恢复走 `_meta` 字段、`session_load_via_meta_field`）通过目录化 `behavior_policy` 容纳（AionCore 模式），不污染统一模型。

### AD-2 后端形态：独立 TypeScript 进程（sidecar），Rust 仅作系统薄壳

**决策**：后端业务逻辑（F0–F7 的领域层）全部用 TypeScript 实现，作为独立进程运行；Tauri/Rust 侧收缩为薄壳。

```text
┌────────────────────────────────────────────────────────────────────┐
│ Tauri WebView（Rust 壳内）                                          │
│   src/  Next.js 前端：Work Room、Agent 资产页、运行控制区            │
└──────────────────────────┬─────────────────────────────────────────┘
                       HTTP/WS（127.0.0.1:<port>，Bearer token）
┌──────────────────────────▼─────────────────────────────────────────┐
│ backend/  TypeScript 后端进程（Bun 运行时）                         │
│   api/（Hono 路由） agents/（F0 控制面） execution/（F1 执行内核）   │
│   store/（SQLite） platform/（进程协议：健康、关停、日志）           │
└──────┬──────────────────────────────┬──────────────────────────────┘
       │ spawn（经 F1 统一入口）        │ SQLite 文件
┌──────▼──────────┐  ┌────────────────▼─────────┐
│ Agent 子进程     │  │ userData/fouc/            │
│ opencode acp    │  │  fouc.db · 事件日志        │
│ bun x → 桥 → codex/claude · bun 缓存            │
└─────────────────┘  └───────────────────────────┘
        ▲
┌───────┴────────────────────────────────────────────────────────────┐
│ src-tauri/  Rust 薄壳：窗口/托盘/自动更新/系统能力桥（Tauri 插件）  │
│   唯一逻辑职责：后端进程看护（spawn、健康检查、崩溃退避重启、        │
│   端口与 token 注入、优雅关停）                                     │
└────────────────────────────────────────────────────────────────────┘
```

**理由**：

1. **可维护性是硬约束**：后端逻辑需要被直接理解与审阅，TS 是团队的主语言；这比任何单进程洁癖更有工程价值；
2. **架构先例充分**：该拓扑与 AionUi 2.x（Electron 前端 ↔ AionCore 后端进程，本地 HTTP/WS）完全同形，已被百万级分发验证；差别仅在他们的后端用 Rust、我们用 TS——形状被验证，语言自选；
3. **迁移成本最低**：官方 TS SDK 正是 AionUi 1.x 所用的 `@agentclientprotocol/sdk`，1.x 的连接管理、权限解析、认证协商等实现可近乎直接移植（TS→TS）；
4. **与桥接运行时同栈**：Codex/Claude 的 ACP 桥本来就是 Node/Bun 包（AionCore 已把启动方式统一为 `bun x`），后端与桥同栈使桥的启动、缓存、修复成为后端内部细节，不存在"Rust 管协议、Node 管桥"的两栖问题；
5. **Rust 壳职责极小化后几乎不需要被触碰**：窗口与系统能力由 Tauri 插件覆盖，进程看护是一段固定模式的代码，后续演进不改变它。

**对比过的替代方案**：

| 方案 | 评价 |
|---|---|
| TS sidecar 后端（选定） | 满足全部约束；代价见下 |
| 全 Rust 核心 + 官方 Rust SDK（`agent-client-protocol`，AionCore 同款） | 技术上优秀（AionCore 生产验证），但违背可维护性硬约束，否决 |
| 逻辑放 Rust、桥放 Node 的混合 | 两栖复杂度最高，两头不讨好，否决 |
| Next.js Node server 内嵌后端 | 桌面端 Next.js 为静态导出（`out/`），无 server 进程；为后端引入 SSR 服务器得不偿失，否决 |

**诚实的代价清单**：分发体积 +（Bun 运行时约 50–90MB）；多一个常驻进程的内存（约 50–80MB）；需要一段 sidecar 生命周期管理（端口分配、健康检查、重启退避——Tauri shell 能力覆盖，模式固定）。

**后端运行时选定 Bun**（开发与分发一致）：

- Bun 原生跑 TS（无需 tsx/ts-node）、`bun --hot` 开发热重载、`bun build --compile` 产出单文件可执行（作为 Tauri sidecar 分发，无运行时依赖）；
- 内置 `bun:sqlite`（零原生模块依赖；better-sqlite3 在 Bun/Node 间的原生模块兼容是历史坑位）；
- `bun x` 正是 AionCore 验证过的桥启动方式，自带运行时即自带桥运行时；
- **纪律**：后端代码保持在 Node 兼容 API 子集内（进程用 `node:child_process`、HTTP 用 Hono 抽象），使"退回 Node sidecar"始终是低成本的逃生通道（Bun 出现平台级问题时启用）。

**进程协议（Rust 壳 ↔ TS 后端）**，唯一需要写的 Rust 逻辑：

1. 启动：选取空闲端口、生成随机 `FOUC_BACKEND_TOKEN`、以数据目录为 cwd spawn 后端，经环境变量注入端口/token/数据目录；
2. 健康：轮询 `GET /health`（带 token），就绪后才向前端放行；
3. 看护：进程退出则按退避重启（1s/5s/30s 封顶），连续失败进入"后端不可用"错误态并暴露诊断；
4. 关停：应用退出时先 `/shutdown`（后端优雅 suspend 会话）再 kill；
5. 前端接入：Tauri command `get_backend_endpoint()` 返回 `{ base_url, token }`，仅WebView 可取。

**安全基线**：后端仅绑定 127.0.0.1；所有 HTTP 路由与 WS 连接要求 Bearer token；token 不落盘、不进日志；WS 鉴权用首帧认证（避免 query string 泄漏）。远程 Web 访问属 F7 范畴，V1 不开。

**开发工作流**：`pnpm dev` 并发起 Next.js dev 与后端 `bun --hot`（concurrently）；`desktop:dev` 时 Tauri 壳以 dev 模式拉起后端。前端在后端未就绪时显示连接状态而非白屏。

### AD-3 桥接策略：本地化工件，杜绝运行时网络拉取

桥接适配器不依赖 `bun x`/`npx` 在用户机器上现下载（编译后的后端 exe 无法充当
bun CLI 传参运行，且运行时网络拉取不可控）。桥以本地工件形态随版本走：

- **版本锁定**：三个桥包（claude-agent-acp / codex-acp / codebuddy）是 `backend/package.json`
  的直接依赖，升级即 Fouc 版本的显式变更；其中 codex 桥是原生二进制（npm 平台包），
  claude/codebuddy 桥是 JS 适配器；
- **开发态**：直接运行 `backend/node_modules` 下的入口（JS 入口经 bun、原生直接执行）；
- **打包态**：JS 桥经 `bun build --compile` 编译为单文件 sidecar（`fouc-bridge-claude`、
  `fouc-bridge-codebuddy`），codex 原生桥直接复制为 sidecar；均经 Tauri externalBin 随应用分发；
- **bun 运行时随包分发**：claude 桥的 claude-agent-sdk 在 Bun 下以 `"bun"` 启动解压出的
  CLI，故 sidecar 目录含 `bun.exe` 并在子进程 PATH 前置（`prepareCleanEnv` 统一处理）；
- **上游补丁**：claude-agent-sdk 0.2.112 发布包缺失 `tempfile.js`（embed 形态编译必需），
  以 pnpm patch 补齐（`patches/claude-agent-sdk-tempfile.patch`）。

### AD-4 Provider 目录：声明式、DB 种子、可被用户覆盖

目录数据落在 SQLite 迁移种子（AionCore 模式，1.x 是代码内静态表——AionCore 的演进方向更利于随版本增删 Agent 与携带行为开关）。每条声明：

```ts
interface ProviderSpec {
  id: 'codex' | 'claude-code' | 'opencode';   // V1 首批三条，结构容纳 AionUi 其余 14 条
  name: string;
  cliCommand: string;            // PATH 检测用命令名
  acpLaunch:                     // ACP 启动方式
    | { kind: 'native'; args: string[] }               // opencode acp
    | { kind: 'bridge'; package: string; version: string };
  authRequired: boolean;
  skillsDir?: string;            // '.codex/skills' 等原生技能目录
  behaviorPolicy?: {             // Agent 私有缝隙目录化（AionCore behavior_policy）
    sessionLoadViaMetaField?: boolean;
    yoloModeId?: string;
  };
  minProtocolVersion: number;
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

Driver 再叠加 Provider 级静态能力，最终产出 L0–L3 层级判定（见 §6）。

### AD-6 参考资产处置原则

- **实现逻辑 → 1.x TS 为主参考**：同语言同 SDK，直接移植（Apache-2.0，保留版权与许可标注）；
- **工程策略 → AionCore 为权威**：bun x 启动、双预算探测、慢代理白名单、registry 锁、缓存自修复、behavior_policy 目录化、stderr 不进客户端错误——按需查阅其 Rust 实现印证做法；
- **产品域模型 → 2.x 前端契约**：`AgentMetadata`、四时机健康检查、错误码 → i18n 体系（语言无关）；
- **不迁移**：Electron IPC/bridge 层、聊天消息模型（chatLib）、YOLO 全局自动批准、Hub 扩展市场（V2 再议）、远程 Agent 与内置引擎（aionrs）代码。

## 二、总体架构

### 2.1 仓库布局（pnpm workspace）

```text
fouc/
├── src/                    # Next.js 前端（Tauri WebView 加载）
├── backend/                # TS 后端（Bun 进程）——领域逻辑全部在此
│   └── src/
│       ├── index.ts        # 进程入口：读 env（端口/token/数据目录）、装配、启动
│       ├── api/            # Hono 路由层：REST + WS、Bearer 鉴权、错误→HTTP 映射
│       ├── agents/         # F0 Agent 控制面
│       │   ├── provider.ts     # Provider 目录（DB 种子读写 + 用户覆盖合并）
│       │   ├── discovery.ts    # 发现服务：候选收集 + 批量 PATH 检测 + 常见位置
│       │   ├── probe.ts        # 探测：身份确认、双预算版本探测、ACP 握手
│       │   ├── capability.ts   # CapabilityManifest 生成与 L0-L3 判定
│       │   ├── registry.ts     # AgentInstallation/Profile 持久化与状态机
│       │   ├── driver/
│       │   │   ├── types.ts    # AgentDriver 接口 + 路由
│       │   │   └── acp/        # connection（进程+协议单责）/ events（事件映射）/ auth
│       │   ├── supervisor.ts   # 会话池、并发/超时、空闲回收、优雅取消、遗留进程
│       │   └── bridge.ts       # bun x 桥缓存：显式安装、registry 锁、损坏修复
│       ├── execution/      # F1 执行内核：spawn 统一入口（agent/cleanCli 两构造器）、
│       │   │               # 环境清洗、超时/取消、进程表
│       ├── store/          # SQLite（bun:sqlite）：迁移、仓储
│       └── platform/       # 进程协议（/health、/shutdown）、日志、路径与 env 基础设施
├── shared/                 # 前后端共享契约（唯一事实源，禁依赖运行时框架）
│   └── src/                #   API DTO 类型 + zod schema + 事件类型 + 错误码枚举
├── src-tauri/              # Rust 薄壳：窗口/系统能力/更新 + backend_supervisor.rs（进程看护）
└── pnpm-workspace.yaml
```

分层规则（借鉴 AionCore 的依赖纪律，语言无关）：`api → agents/execution → store/platform → shared`，严格向下依赖；`shared` 是 API 契约唯一事实源，不依赖 Hono/Bun/Next 任何一侧；上层（未来 Work Room 编排）只依赖 `agents` 暴露的服务接口，不接触进程与协议细节——对应"上层工作流不得直接拼接 CLI 命令"的红线。

### 2.2 与 Fouc 其他 P0 能力的边界

- **F1 执行内核**（`backend/src/execution`）：Agent 子进程必须经 F1 统一入口创建（`agent()` 长驻构造器：kill_on_drop、环境清洗、工作目录固定；`cleanCli()` 短命构造器：版本探测等一次性命令），Agent Driver 不自建进程管理；Git/SSH/脚本执行同样走这里；
- **F3 策略中心**：审批请求（`request_permission`）经 F3 风险分级决策（见 §8），Agent Driver 只负责协议往返；
- **F4 持久化**：所有状态变更（installation 状态、session/run 生命周期、事件、审批）追加写入 `agent_event` 事件日志，UI 状态可由持久事实重建。

### 2.3 API 与事件面（前后端契约）

- REST：`/api/agents/*`（列表/详情/刷新/健康/启停/覆盖）、`/api/sessions/*`、`/api/runs/*`，统一响应包 `{ data, error: { code, message, guidance } }`（错误码枚举放 `shared`）；
- WS：单一 `/ws`，事件两级命名 `agents.installationChanged`、`runs.event:<runId>`（AionCore 同款命名纪律）；
- 前端经 Tauri command 取得 `{ base_url, token }` 后建立连接；断线自动重连（指数退避），重连后由 REST 重建状态。

## 三、领域对象与持久化

### 3.1 对象模型（对齐 local-agent-management.md §三）

| 对象 | 职责 | 与 AionUi 概念映射 |
|---|---|---|
| `AgentProvider` | 一类 Agent 产品 + Driver + 识别规则 + 兼容策略 | 目录表条目 + `agent_source: builtin` |
| `AgentInstallation` | 本机一个真实安装实例（路径、版本、健康、状态） | `DetectedAgent` + `AgentMetadata` 状态/快照字段 |
| `AgentProfile` | 安装实例上的运行偏好（模型、模式、参数、env 白名单、工作空间） | `AgentMetadata` overrides 部分 |
| `CapabilityManifest` | 探测产生的真实能力清单 + L0–L3 层级 | `AgentHandshake`（原样留存握手指纹） |
| `AgentSession` | 多轮会话，绑定 WorkObject、安装实例、工作目录、原生 sessionId | `AcpSession`（增加 Fouc 绑定关系） |
| `AgentRun` | 一次可取消、可审计的执行（prompt 级） | 无对应——Fouc 新增 |

### 3.2 SQLite 表（`backend/src/store/migrations`，嵌入式迁移）

```sql
agent_installation (
  id TEXT PRIMARY KEY,            -- 稳定 id：provider + 归一化路径摘要
  provider_id TEXT NOT NULL,
  executable_path TEXT NOT NULL,
  source TEXT NOT NULL,           -- path | known_location | user_added | package_manager
  version TEXT,
  status TEXT NOT NULL,           -- ready|needs_auth|needs_runtime|incompatible|
                                  -- unhealthy|disabled|missing|unchecked
  capability_manifest TEXT,       -- JSON
  last_probe_at INTEGER, last_probe_kind TEXT,   -- startup|scheduled|manual|session
  last_probe_duration_ms INTEGER,
  last_error_code TEXT, last_error_message TEXT, last_error_guidance TEXT,
  enabled INTEGER DEFAULT 1, is_default INTEGER DEFAULT 0,
  created_at INTEGER, updated_at INTEGER
);

agent_profile (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES agent_installation(id),
  name TEXT NOT NULL,
  default_model TEXT, permission_mode TEXT, extra_args TEXT,  -- JSON array
  env_allowlist TEXT,            -- JSON array：允许注入的环境变量名
  workspace_scope TEXT,
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
  seq INTEGER NOT NULL,
  task_contract_ref TEXT,        -- F5 ContextRef
  status TEXT NOT NULL,          -- queued|running|waiting_input|waiting_approval|
                                 -- cancelling|completed|failed|cancelled
  started_at INTEGER, ended_at INTEGER, exit_info TEXT,   -- JSON（退出码/信号/原因/stderr尾）
  stop_reason TEXT, usage TEXT   -- ACP promptResponse 原样
);

agent_event (                    -- 追加式事件日志
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT, run_id TEXT, installation_id TEXT,
  seq_in_run INTEGER,            -- run 内单调序号，重建流式视图用
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

索引：`(session_id, seq_in_run)`、`(installation_id, last_probe_at)`、`(type, created_at)`。事件中的大字段（工具输出、diff 正文）超阈值时落制品存储，行内只留引用（AionCore 的工具输出清洗同款）。握手产生的目录更新（能力、模型、模式）经单一串行队列落库（AionCore catalog-sync 通道的同款纪律），避免多会话并发写同一行。

## 四、发现服务设计

### 4.1 候选来源与优先级

1. 已登记 installation 的保存路径（优先核实，`missing` 语义来自这里）；
2. 进程可见 `PATH`（批量检测）；
3. 平台常见安装位置（V1 最小集）：Windows `%USERPROFILE%\.local\bin`、`%APPDATA%\npm`、`%LOCALAPPDATA%\Programs`、scoop/winget shim；macOS `/usr/local/bin`、`/opt/homebrew/bin`、`~/.local/bin`；Linux `~/.local/bin`、`/usr/local/bin`；
4. 用户手工添加的可执行文件（文件选择器，覆盖 2/3）。

不做全盘扫描；只对目录内与 `cliCommand` 同名的条目做 `stat`。

### 4.2 批量 PATH 检测（迁移 1.x AcpDetector 算法）

- 命令名先过 `/^[a-zA-Z0-9_.-]+$/` 白名单（防注入），其余拒绝并记诊断；
- POSIX：一次 login shell 执行 `command -v 'a' && echo 'a'; …`（3s 超时）；
- Windows：并行 `where <cmd>`（3s）失败回退 PowerShell `Get-Command`（5s）；
- **GUI 环境 PATH 增强**：后端进程启动早期（装配任何检测之前）合并 login shell PATH——AionUi/AionCore 均把这一步放在进程初始化最前面，是检测结果可信的前提；
- 结果缓存本次探测周期，刷新入口（手动刷新、设置变化、安装器返回）显式触发。

### 4.3 与 AionUi 的差异（安全收紧）

AionUi 检测到命令名存在即 `available: true`（cursor 的 `which agent` 歧义它自己也承认）。Fouc 收紧为：**PATH 命中只产生"候选"，必须经 §5 探测确认身份后才进入 `ready`**；探测前 UI 显示 `unchecked`。

## 五、探测、连接测试与健康检查

### 5.1 probe 流程（身份确认，无持久副作用）

```text
probe(installation):
 1. 解析最终可执行路径（符号链接/Windows shim 归一化），记录真实二进制与目录
 2. 双预算版本探测（AionCore cli_probe 策略）：
    - inline 预算 5s：运行 <cli> --version，输出必须匹配 Provider 版本正则
      （不匹配 → identity_mismatch，防止同名伪 CLI；静默成功 → 版本记 null）
    - 超时 → 不定罪（"slow load, not proof of corruption"），转后台 recheck（30s 预算）
    - 历史探测慢于 2s 的 Agent 跳过 inline 探测（后端就绪不为已知慢 CLI 买单）
 3. 组装 ACP 启动命令（Native 子命令 或 已安装桥），经 F1 执行内核 spawn
 4. ACP initialize 握手（10s 超时）：记录 agentInfo、protocolVersion、auth_methods、capabilities
 5. （可选）session/new → 立即 close，采集 configOptions/modes/models
 6. 优雅终止子进程（stdin close → grace 100ms → kill）
 7. 生成 CapabilityManifest，判定 L 层与状态，写 installation + 事件日志
```

### 5.2 两阶段失败分类（迁移 AionUi try-connect 语义 + AionCore 错误分类）

| 阶段 | 失败 | 错误码 | 修复引导 |
|---|---|---|---|
| CLI | spawn 失败 / ENOENT | `command_not_found` | 安装 CLI 或修正路径 |
| CLI | 版本输出不匹配 Provider 正则 | `identity_mismatch` | 该文件不是预期的 Agent |
| CLI | `--version` 快速失败（退出码非 0） | `version_probe_failed` | 疑似损坏安装，重装 |
| CLI | `--version` 超时 | `version_probe_timeout` | 慢而非坏；后台复查定论 |
| CLI | 桥未安装且受管运行时缺失 | `bridge_missing` / `runtime_missing` | 执行桥安装引导 |
| 协议 | initialize 超时 / 进程早退（含退出码 0 无输出的"不支持 ACP"形态） | `acp_init_failed` | 升级 CLI 到支持 ACP 的版本 |
| 协议 | protocolVersion 不在兼容范围 | `incompatible_version` | 升级 CLI 或等待 Fouc 适配 |
| 认证 | 握手成功但 auth_required 且无可用认证 | `auth_required` | 进入 Agent 原生认证引导（不索取密钥） |

启动错误消息翻译模式整体迁移自 1.x `buildStartupErrorMessage`；stderr 尾部仅进本地诊断日志与 `diagnose()`，不进入返回给 UI 的错误正文（AionCore 的脱敏边界）。

### 5.3 健康检查时机与节流

四时机（迁移）：`startup`（启动后后台刷新已登记项）、`manual`（资产页刷新/诊断）、`session`（建会话前轻复核：存在性 + 版本命令，不重复完整握手）、`scheduled`（V1 默认关闭）。节流：同一 installation 完整 probe 间隔下限 5 分钟，`session` 级轻检查不受限。探测并发度 8（AionCore 同值）。

## 六、能力清单与适配层级

```ts
interface CapabilityManifest {
  adapterLevel: 'L0' | 'L1' | 'L2' | 'L3';
  protocol: { kind: 'acp'; version: number };
  version: string | null;
  session: { resume: boolean; fork: boolean; list: boolean; close: boolean; multiTurn: boolean };
  input: { image: boolean; audio: boolean; embeddedContext: boolean };
  controls: { models: ModelInfo[]; modes: ModeInfo[]; configOptions: ConfigOption[] };
  extensions: { mcp: { stdio: boolean; http: boolean; sse: boolean }; skillsDir?: string };
  events: AgentEventType[];      // 实际观测到/声明的标准事件类型集合
  auth: { methods: AuthMethodInfo[]; needsAuth: boolean };
  probedAt: number;
  fingerprint: string;           // (version, protocolVersion, caps) 摘要
}
```

| 层级 | 判定 |
|---|---|
| L0 发现 | 路径与身份确认，但版本/协议探测失败——只可登记与诊断 |
| L1 进程 | spawn 成功且 initialize 成功，但不支持 `session/load`——一次性任务 |
| L2 会话 | L1 + `capabilities.loadSession == true`——多轮、可恢复（首批三家必须达到） |
| L3 结构化 | L2 + tool_call 事件 + request_permission + usage 上报——完整编排与审批 |

`fingerprint` 变化（Agent 升级导致事件格式变化）时保守降级：停用结构化自动化，标记 `incompatible` 待重新探测——对应验收标准"Agent 升级导致事件格式变化时标记不兼容，不误判成功"。

## 七、Agent Driver 与统一事件流

### 7.1 Driver 接口

```ts
export interface AgentDriver {
  readonly provider: ProviderSpec;
  probe(installation: AgentInstallation): Promise<ProbeReport>;       // 无副作用身份确认
  createSession(input: CreateSessionInput): Promise<AgentSession>;   // spawn + initialize + session/new
  send(run: AgentRun, input: RunInput): Promise<void>;                // 会话内下发一次任务
  subscribe(sessionId: string): AsyncIterable<AgentEvent>;            // 标准事件流
  cancel(runId: string): Promise<void>;                               // 优雅取消
  resume(sessionId: string): Promise<AgentSession>;
  terminate(sessionId: string): Promise<void>;                        // 终止会话及子进程
  diagnose(sessionId: string): Diagnostics;                           // 原始 stderr/exit/日志引用
  ext(sessionId: string, method: string, params: unknown): Promise<unknown>;  // 私有缝隙通道
}
```

上层仅依赖接口 + `routeDriver(installationId)`；新增协议（远程 Agent、A2A）即新增 Driver 实现。

### 7.2 AcpConnection（移植 1.x ProcessAcpClient，改跑在 Bun/Node 子进程上）

一个连接 = 一个子进程 + 一组 ACP 会话，工程要求逐条对应 1.x 已验证的模式：

- **4 信号退出检测**：进程 exit、stdout EOF、SDK 连接 abort、显式 close；first-write-wins 记录 `AgentExitInfo { exitCode, signal, reason, stderrTail, unexpectedDuringPrompt }`；
- **stderr 环形缓冲 8KB**：启动即捕获，随退出信息带出，落 `agent_run.exit_info`；
- **启动失败监视**：`Promise.race(initialize, 进程退出)`，SDK 的笼统断连错误归一化为带 stderr/退出码的 `AgentStartupError`；
- **pending 请求注册表**：断连时全部 reject 为 `AgentDisconnectedError`，运行中 Run 标记 `failed` 并保留已产出事件；
- **三阶段关闭**：`session/cancel`（若在 prompt 中）→ stdin close + grace → kill（进程组）。

### 7.3 标准事件映射（ACP sessionUpdate → Fouc 事件）

| ACP update | Fouc 事件 | 备注 |
|---|---|---|
| `user_message_chunk` | `message.delta`（role=user） | 回显用户输入 |
| `agent_message_chunk` | `message.delta`（role=agent） | 流式正文 |
| `agent_thought_chunk` | `thought.delta` | 仅存摘要级；不持久化隐式思维链（安全底线） |
| `tool_call` / `tool_call_update` | `tool.started` / `tool.completed` / `tool.failed` | content 含 diff 时发 `artifact.changed` |
| `plan` | `plan.updated` | 条目级状态 |
| `current_mode_update` 等 | `control.updated` | 模式/模型/配置变化 |
| promptResponse `stopReason`/`usage` | `run.completed` 附带 | 用量入 Run |
| `session/request_permission`（反向请求） | `approval.required` → 审批后回写选项 | 见 §8 |
| 连接生命周期 | `session.started/ended`、`run.started/failed/cancelled` | Driver 合成 |

原生协议不提供的事件类型在 `events` 能力中声明不支持，UI 相应降级（不猜测）。

## 八、审批与权限衔接（F3）

`request_permission` 到达后的决策链（替代 AionUi 的 YOLO 三级模式，保留其审批缓存思想）：

```text
approval.required
  → F3 策略评估：工具/命令风险 × Profile 权限模式 × Workspace 策略
      ├─ read 类且策略允许 → 自动 allow_once（缓存决策）
      ├─ 白名单（kind+title+command/path 键，LRU 500，仅 allow_always 入缓存）→ 自动放行
      ├─ 超出自动范围 → Work Room 审批卡片（四选项语义原样映射），等待用户
      └─ 策略禁止（如 write-remote 未授权）→ 自动 reject_once + 记录
  → approval.resolved 事件 + 回写 ACP outcome
```

- ACP 的 `allow_always` 语义映射为 Fouc 的 scoped delegation（绑定 installation + 命令指纹 + 有效期），存 F3，可吊销；
- `auth_required`（Agent 层登录）与工具审批是两件事：前者引导进入 Agent 原生认证（由用户在终端完成，Fouc 只检测状态），后者走上述决策链。

## 九、会话监督与生命周期（supervisor）

- **会话池**：`Map<SessionId, SupervisedSession>`，含连接句柄、状态机（`idle/active/prompting/cancelling/suspended/ended/unrecoverable`）、`lastActiveAt`；
- **空闲回收**：默认 10 分钟空闲 → `session/close` + 优雅退出；回收后新消息自动走 `resume`（`session/load`），不可恢复则显式建新会话并生成上下文交接说明；
- **取消语义**：`run.cancel` → ACP `cancel` → 2s 内未结束提示"进程仍在运行"，提供强制终止（UI 区分"请求取消"与"进程已结束"）；
- **并发与资源**：每 installation 默认并发 Run 上限（V1 = 1）、全局子进程上限、per-run 超时（Profile 可配，默认无上限但空闲 watchdog 兜底）；
- **遗留进程处理**：启动时扫描 `agent_run.status IN (running, waiting_*)` 且无存活连接的记录 → 标记 `failed`（`orphaned`），并按 PID/启动时间核对进程表清理孤儿（AionCore startup cleanup 同款语义）；
- **工作目录隔离**：`createSession` 必须携带 WorkObject 绑定的隔离工作区路径（F2 worktree），Driver 拒绝默认 cwd 的写入类会话。

## 十、安全边界（对照 architecture-and-security.md §七）

- 凭据：不读取/复制 Agent 原生凭据存储；认证引导走原生流程；Profile 只保存环境变量**名**白名单，值在会话创建时从系统环境读取注入，不落库不进日志（AionUi AuthNegotiator 的"秘密只走子进程 env"原则）；
- 环境变量：子进程默认继承白名单化的最小集（PATH/HOME/TERM/Agent 认证相关变量）；NODE_OPTIONS/npm_* 清洗经验对桥进程（Node 生态）同样适用；
- 探测只读元数据，不执行来源不明候选；身份正则不过即拒绝；
- 桥包显式安装、版本固定（registry 锁）、完整性校验；
- 后端仅监听 127.0.0.1 + 随机 token；事件日志中的命令与参数脱敏，`diagnose` 输出经同一脱敏器；stderr 尾部不进 UI 错误正文。

## 十一、前端设计（Next.js 渲染进程）

V1 交付四个界面（对齐 local-agent-management.md §九）：

1. **Agent 资产页**：Provider 分组的 installation 列表——名称、版本、路径、状态徽章（含原因与修复入口，错误码 → i18n 模板体系迁移自 AionUi 2.x）、适配层级（L0–L3 徽章）、默认标记、最近探测时间与耗时；操作：刷新发现、添加路径、设为默认、启用/停用、诊断、解除纳管、打开原生终端/配置目录、桥安装向导（内嵌两阶段连接测试视图：CLI 检查 → ACP 握手，失败定位到阶段与错误码）。
2. **Agent 详情页**：CapabilityManifest 可视化（会话/输入/控制/扩展/事件分组）、Profiles 管理（模型、权限模式、env 白名单、工作空间）、健康历史（最近探测记录、错误详情、延迟）、原生配置位置引用。
3. **Work Room 执行器选择**：按 TaskContract 需求过滤可用 Agent（能力 + 状态 + 工作空间），显示能力差异提示（如"L1：本 Agent 不支持会话恢复，任务不可暂停"）。
4. **运行控制区**：当前阶段、Agent、会话、工作目录、权限、运行时间、事件流、审批卡片和取消/接管入口；后端连接状态条（未就绪/重连中显式呈现，不白屏）。

数据通道：REST（查询/操作）+ WS（`agents.installationChanged`、`runs.event:<runId>` 流式推送）。

## 十二、从 AionUi / AionCore 迁移的资产清单

### 12.1 主参考：1.x（TS，可直接移植）

源路径均在 AionUi git tag `archive/main-before-backend-migration-2026-05-25` 下；代码级复用保留 `Copyright 2025 AionUi (aionui.com)` 头 + Apache-2.0 标注 + NOTICE。

| # | 源 | Fouc 去处 | 形态 |
|---|---|---|---|
| 1 | `src/common/types/acpTypes.ts` 的 `ACP_BACKENDS_ALL` | `agents/provider` 目录种子 | 数据转写，V1 启用 3 条 |
| 2 | `src/process/agent/acp/AcpDetector.ts` 批量检测算法 | `agents/discovery.ts` | 直接移植（TS→TS） |
| 3 | `AcpConnection.buildStartupErrorMessage` 错误翻译模式 | `agents/probe.ts` | 模式迁移（正则族） |
| 4 | `src/process/acp/infra/ProcessAcpClient.ts` 生命周期模式 | `agents/driver/acp/connection.ts` | 直接移植（同 SDK） |
| 5 | `src/process/acp/session/PermissionResolver.ts` 审批缓存 | F3 审批决策链缓存层 | 逻辑移植 |
| 6 | `src/process/acp/session/AuthNegotiator.ts` | `agents/driver/acp/auth.ts` | 逻辑移植 |
| 7 | `src/process/acp/infra/NdjsonTransport.ts` | SDK 直接提供（ndJsonStream），无需自写 | 引用即可 |

### 12.2 权威参考：AionCore（Rust，按需查阅印证做法）

源路径在 `opensource/AionCore/crates/`：

| # | 源 | Fouc 采纳点 |
|---|---|---|
| 8 | `aionui-db/migrations/001_initial_schema.sql` 目录种子 | codex/claude 的 `bun x --bun` 启动行、behavior_policy/yolo_id 字段设计 |
| 9 | `aionui-ai-agent/src/cli_probe.rs` | 双预算（5s/30s）、慢代理阈值 2s、失败/超时/静默三态分类、reported_version 留存 |
| 10 | `aionui-ai-agent/src/registry.rs` | DB 目录 hydrate、探测并发 8、目录更新单写串行化、UnavailableReason |
| 11 | `aionui-runtime/src/registry_npx_lock.rs` + `corrupt_npx_cache_repair` | 桥 registry 锁与缓存损坏定向修复 |
| 12 | `aionui-runtime`（spawn Builder、node_runtime/managed） | F1 执行内核的 agent/cleanCli 双构造器；受管运行时分发形态 |
| 13 | `aionui-ai-agent/src/manager/acp/agent.rs` | 启动崩溃与超时分开归因、stderr 尾部只进日志不进客户端错误 |

### 12.3 契约参考：2.x 前端（语言无关）

`AgentMetadata` 模型、四时机健康快照、错误码 → i18n 模板体系、`GET /api/agents/management` 的"含禁用/丢失行的诊断视图"语义。

## 十三、实现里程碑

| 里程碑 | 内容 | 验证方式 |
|---|---|---|
| M0 后端骨架 | `backend/` + `shared/` workspace、Hono server + Bearer 鉴权 + /health、Rust 壳进程看护（spawn/重启退避/token 注入）、前端连接状态条 | 壳拉起后端→健康就绪→前端通；kill 后端→退避重启→前端恢复 |
| M1 发现与登记 | provider 目录种子（3 家）、discovery 批量检测、registry 持久化、资产页列表 + 添加路径 + 启停 | 装有 0/1/2/3 个 Agent 的机器上发现准确，`missing`/`unchecked` 语义正确 |
| M2 探测与能力 | probe 全流程（双预算）、两阶段失败分类、CapabilityManifest 生成落库、健康四时机、详情页能力视图 | 三家真实安装握手成功；伪造同名二进制被 `identity_mismatch` 拒绝；版本不兼容标记正确 |
| M3 会话与运行 | ACP Driver（connection/transport）、create/send/cancel/terminate、session/run 落库、运行控制区 UI | 三家各完成一次真实任务：创建→下发→流式→取消→终止；崩溃保留诊断 |
| M4 事件与审批 | 标准事件映射、事件日志、approval 决策链（F3 接入）、审批卡片 UI | 工具审批全链路（自动/缓存/人工/策略拒绝四路径）；事件流可重放 |
| M5 恢复与健壮 | resume/suspend、空闲回收、遗留进程清理、指纹漂移降级、应用重启恢复 | 重启 Fouc 后会话可恢复或明确不可恢复；Agent 升级后漂移被识别 |

每个里程碑完成即过对应验收场景（local-agent-management.md §十二），全部通过后更新 F0 状态。

## 十四、验收标准对照

| V1 验收标准（core-features.md） | 本设计的落实点 |
|---|---|
| 自动发现三家 CLI 并准确展示路径、版本、健康 | §4 发现 + §5 探测 + §11 资产页 |
| 基线操作：创建会话/下发/流式/追加/取消/结束 | §7 Driver + §9 supervisor |
| 不支持的操作明确降级 | §6 CapabilityManifest.events + 执行器选择页能力差异提示 |
| 崩溃/退出/协议异常可识别并保留诊断 | §7.2 退出信息 + stderr 缓冲 + orphaned 处理 |
| 不复制凭据、不破坏配置、不静默升级 | §10 安全边界 + AD-3 本地化工件（无运行时拉取） |
| 操作关联用户/工作对象/工作目录/权限/审计 | §3.1 对象绑定 + 事件日志 + §8 审批链 |

## 十五、风险与开放问题

1. **Bun 作为后端常驻运行时的成熟度**：AionUi/AionCore 已在 Windows 生产环境用 Bun 跑桥与受管运行时，但 Fouc 把整个后端押在 Bun 上属于更重用法。缓解：代码保持 Node 兼容 API 子集（进程/HTTP/文件操作走标准 API 与 Hono 抽象），SQL 层隔离在 `store/` 单目录——必要时可低成本切回 Node sidecar（better-sqlite3）。
2. **Claude Code 原生 ACP 进展**：若官方提供原生 ACP 模式（免桥），目录切一行声明即可；探测逻辑天然支持"优先原生、桥兜底"。保持跟踪。
3. **ACP unstable 方法**（set_model/close/fork）跨 Agent 行为差异：CapabilityManifest 已声明，UI 按 Agent 差异呈现，不做统一伪装。
4. **Windows shim 解析**（npm .cmd、pwsh shim）多层包装导致真实二进制定位复杂：M1 做归一化专项验证（`where` 结果 + shim 内容解析）。
5. **sidecar 端口/token 生命周期的边角**（端口被占、壳先于后端死亡）：M0 的看护协议 + 前端连接状态条兜底，属一次性固定成本。
6. **首次完整探测耗时**（桥冷启动 + 握手）：启动健康检查后台化、资产页异步渐进展示；慢代理白名单（§5.1）进一步压缩就绪路径。

## 参考

- AionUi 仓库：`opensource/AionUi`（本仓库内，2.2.0）；1.x 实现见 git tag `archive/main-before-backend-migration-2026-05-25`
- AionCore 源码：`opensource/AionCore`（tarball 快照，2026-08-30）；上游 github.com/iOfficeAI/AionCore（Apache-2.0）
- ACP 官方：[agentclientprotocol.com](https://agentclientprotocol.com/)、TS SDK `@agentclientprotocol/sdk`、Rust SDK [crates.io/agent-client-protocol](https://crates.io/crates/agent-client-protocol)
- Bun：[bun.sh](https://bun.sh)（`bun build --compile`、`bun x`、`bun:sqlite`）
