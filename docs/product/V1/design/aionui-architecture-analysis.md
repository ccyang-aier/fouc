# AionUi 架构与代码分析

> 分析对象：`opensource/AionUi`（iOfficeAI/AionUi，commit `18022a49`，版本 2.2.0）及其配套仓库 AionCore（`opensource/AionCore`，main 分支源码快照，2026-08-30 提取）。
> 分析目的：为 Fouc V1「本机 Agent 自动发现与统一纳管」提供参考实现与可迁移资产清单。
> 配套设计：[Fouc 本机 Agent 发现与纳管实现设计](./fouc-agent-management-design.md)。

## 重要事实澄清

**许可证是 Apache-2.0，不是 MIT。** AionUi 仓库根目录 `LICENSE` 与 `package.json` 均为 Apache-2.0，源文件头部统一标注 `SPDX-License-Identifier: Apache-2.0`；配套后端仓库 AionCore 同样是 Apache-2.0。

Apache-2.0 同样允许自由复用、修改与商用，且附带明确的专利授权（比 MIT 更完整的专利保护），但对 Fouc 的合规要求略高于 MIT，落地时必须做到：

1. 复用代码的文件中保留原有版权声明与 SPDX 标识（`Copyright 2025 AionUi (aionui.com)`）；
2. 在 Fouc 发行物中保留 Apache-2.0 许可证副本，并对修改过的文件做出显著标注（`NOTICE` 文件或文件头修改声明）；
3. 不使用 AionUi 的名称与商标为 Fouc 背书。

结论：**"自由复用它的逻辑和代码"成立，但按 Apache-2.0 的义务执行，不是 MIT 的义务。** 逻辑与算法层面的借鉴（思想不受版权保护）无此负担，本文档第二部分的迁移清单会逐项区分"代码级复用"与"逻辑级重写"。

## 一、项目定位与总体架构

AionUi 自我定位为 "Cowork app with AI Agents"：把命令行 AI Agent 变成现代图形界面，内置 Agent 引擎开箱即用，同时纳管数十个外部 CLI Agent（Claude Code、Codex、OpenCode、Qwen Code、Goose、Cursor Agent、Kimi 等），并支持远程访问与定时自动化。

### 1.1 两代架构

AionUi 在 2026-05 完成了一次重大架构迁移（git tag `archive/main-before-backend-migration-2026-05-25` 是迁移前快照，可完整检出）：

| | 1.x（迁移前） | 2.x（当前 main） |
|---|---|---|
| 形态 | 单体 Electron 应用 | Electron 前端 + 独立后端二进制 `aioncore` |
| 后端语言 | TypeScript（Node 主进程） | Rust（Axum + Tokio + SQLite） |
| Agent 管理逻辑 | 在本仓库 `src/process/agent`、`src/process/acp` | 在独立仓库 iOfficeAI/AionCore |
| 前后端通信 | Electron IPC | 本地 HTTP REST + WebSocket |
| 分发 | 单安装包 | 安装包 + 按平台下载 aioncore（`resources/bundled-aioncore/{platform}-{arch}/`） |

对 Fouc 最有分析价值的是两条线都要看：

- **1.x 代码（归档 tag 内）**：Agent 发现、ACP 连接、会话运行时的完整 TypeScript 实现，逻辑清晰、体量适中，是"可以直接读和搬"的部分；
- **2.x 代码（当前 main）**：与 Rust 后端之间的 HTTP API 契约、统一 Agent 元数据模型（`AgentMetadata`）、管理视图语义（健康检查快照、错误码体系），是"产品化后的领域模型"参考；Rust 后端 AionCore 的架构文档进一步印证了其进程监督与环境工程的设计。

### 1.2 当前 monorepo 结构

```text
AionUi/
├── packages/
│   ├── desktop/          # Electron 应用（本分析的主对象）
│   │   └── src/
│   │       ├── common/     # 主进程与渲染进程共享：类型、适配器、配置
│   │       ├── process/    # 主进程：backend 解析、bridge、services
│   │       ├── preload/    # 上下文桥
│   │       └── renderer/   # React 前端（页面、hooks、组件）
│   ├── web-host/         # WebUI 模式：启动后端 + 静态服务 + agent 进程注册表
│   ├── web-cli/          # WebUI 命令行入口（远程访问、管理员密码）
│   └── shared-scripts/   # 构建脚本（prepare-aioncore 等）
├── packages/desktop/src/process/backend/binaryResolver.ts   # aioncore 二进制定位
└── docs/                # guides、PRD（teams/cron/remote 等）
```

`binaryResolver.ts` 展示了后端二进制的解析顺序，本身也是一个小而完整的"二进制发现"参考实现：环境变量覆盖（`AIONUI_BACKEND_BIN`，设置但文件不存在时**显式报错**而非静默回退）→ 应用内置 → 系统 PATH（`where`/`which`），全过程携带诊断信息（`BackendBinaryResolveDiagnostics`：检查过的路径、目录条目、查找命令与结果）。

### 1.3 AionCore 后端（Rust）

AionCore 是 2.x 的核心引擎，开源（Apache-2.0），Cargo workspace 27 个 crate。本地源码位于 `opensource/AionCore`（tarball 提取、无 git 历史，不影响代码分析）。与 Agent 纳管直接相关的 crate：

| crate | 职责 | 规模感 |
|---|---|---|
| `aionui-ai-agent` | Agent 目录注册中心、探测、ACP 连接与会话管理、能力管线 | 108 个源文件，2.5MB |
| `aionui-session` | 会话状态（state/reducer/event 模式）、直连 CLI 与 ACP 统一适配 | 2.3MB |
| `aionui-runtime` | 受管 bun/Node 运行时、命令解析、统一 spawn Builder、npx 锁 | 252KB |
| `aionui-process` | 受监督子进程生命周期、隔离与启动清理 | 156KB |
| `aionui-db` | SQLite 仓储层（Repository trait + 嵌入式迁移） | — |
| `aionui-api-types` | API 契约唯一事实源（禁依赖 HTTP 框架） | — |

Agent 域四个核心 crate 合计约 10 万行 Rust；作为对照，1.x 的等价域是 78 个 TS 文件、约 2.1 万行。**2.x 不只是语言重写，而是约 5 倍规模的深化重构**，关键演进在 §六之后逐一展开，这里先记录四个基础工程决策：

- **PATH 增强在 `main()`、tokio 启动前完成**（合并 login-shell PATH、继承 PATH、平台回退）——GUI 应用拿不到 shell 环境是所有桌面 Agent 工具的第一坑；
- **spawn 统一入口**：`Builder`（`spawn.rs`）提供 `agent`（长驻 CLI）与 `clean_cli`（短命工具）两种预设构造器，均设 `kill_on_drop` 并剥离 debug 环境变量，禁止散落的裸 spawn；
- **官方 Rust ACP SDK 生产可用**：依赖 `agent-client-protocol = "2.0.0"`（启用 `unstable_session_fork`、`unstable_end_turn_token_usage` 特性）——ACP 官方 Rust SDK 由 Zed 维护并被 AionCore 用于生产，这佐证了 ACP 协议本身的多语言成熟度（Fouc 走 TS 路线用官方 TS SDK，同理）；
- **目录进数据库**：内置 Agent 目录不再是代码内静态表，而是 `001_initial_schema.sql` 起的迁移种子（INSERT 行含 id、图标路径、backend、agent_source、`agent_source_info` JSON、command、args、skills 目录、`behavior_policy` JSON、yolo_id），后续迁移持续增删 Agent（hermes、openclaw、pi、mimo_code 等）。

## 二、Agent 纳管领域模型

### 2.1 DetectedAgent：执行引擎的统一抽象

`packages/desktop/src/common/types/agent/detectedAgent.ts` 定义了核心抽象。AionUi 的关键概念切分是：**"检测到的执行引擎"与"用户配置的助手"分离**——助手（Assistant）是引用执行引擎的配置层（技能、提示词、头像），不是被检测对象。

执行引擎按通信协议分为 5 种 kind（泛型 `DetectedAgent<K>` 按 kind 收窄字段）：

| kind | 含义 | kind 特有字段 |
|---|---|---|
| `acp` | ACP 协议 CLI Agent | `cli_path`、`acpArgs`、`isExtension`、`custom_agent_id` |
| `remote` | 远程 WebSocket Agent | `remoteAgentId`、`url`、`protocol`（openclaw/zerocaw/acp）、`authType` |
| `aionrs` | 内置 Rust 引擎 | `cli_path`、`version` |
| `openclaw-gateway` | OpenClaw 网关 | `cli_path`、`gatewayUrl` |
| `nanobot` | Nanobot 引擎 | `cli_path` |

公共字段：`id`、`name`、`kind`、`available`、`backend`（路由与显示用后端标识）。

### 2.2 AgentMetadata：2.x 的统一持久化模型

2.x 把纳管状态沉淀到 AionCore 的 `agent_metadata` 表，前端类型 `packages/desktop/src/renderer/utils/model/agentTypes.ts` 完整反映了这个模型，是产品化程度最高的参考：

```text
AgentMetadata
├── 身份：id、name、name_i18n、description、avatar、backend（厂商）
├── 分类：agent_type（5 种 kind）、agent_source（internal/builtin/extension/custom）
├── 启动：command、args、env[]、agent_source_info（binary_name/bridge_binary/version）
├── 状态：enabled、available、installed、status（online/offline/missing/unchecked）
├── 覆盖：has_command_override、env_override_key_count（用户对内置目录的定制）
├── 握手：handshake { agent_capabilities、auth_methods、config_options、
│                    available_modes、available_models、available_commands }
└── 健康快照：last_check_status/kind/error_code/error_message/error_details/
              guidance/latency_ms/at、last_success_at、last_failure_at
```

三个设计要点：

1. **能力来自握手而非静态声明**：`handshake` 字段是 ACP `initialize`/`session/new` 响应的原样留存。能力清单（loadSession、MCP 传输、fork/resume、模型列表、模式列表）是运行时探测出来的，这正是 Fouc `CapabilityManifest` 要求的"能力清单必须由版本探测与 Driver 规则产生"。
2. **健康检查是一等公民**：`last_check_kind` 区分四种触发时机（`startup` 启动时 / `scheduled` 定期 / `manual` 用户手动 / `session` 会话建立时），带错误码、错误详情、修复引导（guidance）、延迟和成功/失败时间戳。
3. **错误码体系面向用户**：`command_not_found`、`bridge_missing`、`primary_missing`、`acp_init_failed`、`auth_required`、`health_check_failed`、`session_send_failed`、`no_provider`、`disabled`、`no_command`，每个错误码有 i18n 模板，把底层失败翻译成"缺什么、去哪修"。

## 三、Agent 发现机制（1.x 完整实现）

### 3.1 三个发现来源

`src/process/agent/acp/AcpDetector.ts`（归档 tag 路径，下同）是纯检测模块，自身无状态，编排由 AgentRegistry 负责：

| 来源 | 数据源 | 是否校验 CLI 存在 |
|---|---|---|
| 内置（builtin） | 静态目录 `POTENTIAL_ACP_CLIS`（由 `ACP_BACKENDS_ALL` 过滤生成） | 是，批量 PATH 检测 |
| 扩展（extension） | ExtensionRegistry 中扩展声明的 `contributes.acpAdapters` | 否（扩展可信，且可声明 `defaultCliPath` 如 `bunx @augmentcode/auggie` 兜底） |
| 自定义（custom） | 用户配置存储 `acp.customAgents` | 否（用户对自己给的路径负责） |

### 3.2 批量 PATH 检测算法

这是可直接迁移的核心算法，针对性能与平台差异做了细致处理：

- **命令名白名单过滤防注入**：`/^[a-zA-Z0-9_.-]+$/` 之外的命令直接剔除，才拼进 shell；
- **POSIX 单次 shell 调用**：把 N 个 `command -v 'x' && echo 'x'` 用 `;` 连接成一条脚本，一次 spawn 完成全部检测（避免逐命令起进程）；
- **Windows 双重回退**：并行 `where <cmd>`（3s 超时）失败后再试 PowerShell `Get-Command -All`（5s 超时）；`where` 在某些环境（PATH 含特殊字符）不可靠，PowerShell 是兜底；
- **环境缓存**：`getEnhancedEnv()` 结果缓存，刷新时 `clearEnvCache()` 以发现新装/卸载的 CLI；
- **诊断日志**：未找到的命令连同截断的 PATH（前 500 字符）一起打日志，便于用户报障。

### 3.3 AgentRegistry：状态编排

`src/process/agent/AgentRegistry.ts` 是注册中心，模式清晰：

- **并行检测 + 分区缓存**：builtin/extension/remote/custom 四路 `Promise.all`，各自缓存结果；
- **互斥变更队列**：`runExclusiveMutation` 把所有刷新操作串行化（Promise 链式锁），避免并发刷新竞态；
- **细粒度刷新**：`refreshBuiltinAgents`（PATH 可能变化）、`refreshExtensionAgents`（扩展热重载后）、`refreshRemoteAgents`（远程配置 CRUD 后）、`refreshCustomAgents`（用户编辑后）、`refreshAll`（Hub 安装后，onInstall 钩子可能装了新 CLI）各有独立入口；
- **按 backend 去重**，优先级 Aionrs > Gemini > Builtin > Other > Remote > Extension > Custom（内置声明优先于扩展贡献的同类 backend；remote/custom 用唯一 id 寻址，跳过 dedup）。

### 3.4 内置 Agent 目录

`src/common/types/acpTypes.ts` 的 `ACP_BACKENDS_ALL` 是"数十个 Agent"的具体形态——**每个 Agent 只是一条声明式记录**，差异被压缩为三个参数：

| id | 名称 | cliCommand | ACP 启用方式 | 桥接包 |
|---|---|---|---|---|
| claude | Claude Code | `claude` | 默认 `--experimental-acp` | `@agentclientprotocol/claude-agent-acp@0.29.2`（npx） |
| codex | Codex | `codex` | 无需参数（桥即 ACP） | `@zed-industries/codex-acp@0.9.5`（npx，Win/Linux 优先平台专用子包） |
| qwen | Qwen Code | `qwen` | `--acp` | 可 `npx @qwen-code/qwen-code` |
| opencode | OpenCode | `opencode` | `acp` 子命令 | 原生 |
| goose | Goose | `goose` | `acp` 子命令 | 原生 |
| auggie | Augment Code | `auggie` | `--acp` | 原生 |
| kimi | Kimi CLI | `kimi` | `acp` 子命令 | 原生 |
| droid | Factory Droid | `droid` | `exec --output-format acp` | 原生 |
| copilot | GitHub Copilot | `copilot` | `--acp --stdio` | 原生 |
| cursor | Cursor Agent | `agent` | `acp` 子命令 | 原生（检测有歧义：`agent` 命令名太通用，注释明确提示风险） |
| kiro | Kiro | `kiro-cli` | `acp` 子命令 | 原生 |
| codebuddy | CodeBuddy | `codebuddy` | `--acp` | `@tencent-ai/codebuddy-code`（npx） |
| qoder | Qoder CLI | `qodercli` | `--acp` | 原生 |
| vibe | Mistral Vibe | `vibe-acp` | 无参数 | 原生 |
| hermes | Hermes Agent | `hermes` | `acp` 子命令 | 原生 |
| snow | Snow CLI | `snow` | `--acp` | 原生 |
| custom | 用户自定义 | — | 用户配置 | — |

每条记录还携带：`authRequired`（是否需要认证）、`skillsDirs`（原生技能目录如 `.claude/skills`，决定技能是原生发现还是首条消息注入）、`enabled`（灰度开关，未验证的 agent 置 false）。

**这是整个项目最重要的架构洞察：AionUi 没有为每个 Agent 写私有适配器，而是统一押注 ACP（Agent Client Protocol，Zed 主推的编辑器—Agent 通信标准）。** 纳管新 Agent 的成本从"解析私有 CLI 输出格式"降为"目录里加一行声明"。Fouc 规划中的 Codex、Claude Code、OpenCode 三家全部在列。

## 四、ACP 协议栈

### 4.1 直接使用官方 SDK

AionUi 没有自研协议编解码，1.x 的 `src/process/acp/infra/` 建立在 `@agentclientprotocol/sdk`（ACP 官方 TypeScript SDK）之上：

- `AcpProtocol.ts`：对 SDK `ClientSideConnection` 的薄封装；
- `NdjsonTransport.ts`：传输适配——子进程 stdio（`ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout))`）与 WebSocket 两种，NDJSON（按行分隔的 JSON-RPC）。

### 4.2 协议方法全景

从封装层看 ACP 协议面（即 Fouc 需要实现的全部协议交互）：

**正向（client → agent）**

| 方法 | 作用 | 稳定性 |
|---|---|---|
| `initialize` | 握手：clientInfo、protocolVersion、clientCapabilities（fs 读写） | 稳定 |
| `authenticate` | 按 methodId 完成认证 | 稳定 |
| `session/new` | 建会话：cwd、mcpServers、additionalDirectories | 稳定 |
| `session/load` | 恢复会话（sessionId + cwd） | 稳定 |
| `session/prompt` | 下发任务/追加指令（content 块数组） | 稳定 |
| `session/cancel` | 取消当前 turn | 稳定 |
| `session/set_mode` | 切换权限模式（如 yolo 对应的模式 id） | 稳定 |
| `session/fork` | 会话分叉 | experimental |
| `session/set_model` | 切换模型 | unstable |
| `setSessionConfigOption` | 设置会话配置项（string/boolean） | 稳定 |
| `session/close` | 关闭会话 | unstable |

**反向（agent → client，回调）**

| 回调 | 作用 |
|---|---|
| `session/update` | 事件流：`user_message_chunk`、`agent_message_chunk`、`agent_thought_chunk`、`tool_call`/`tool_call_update`（status: pending/in_progress/completed/failed；kind: read/edit/execute；content 含 diff）、`plan`（条目带 pending/in_progress/completed 状态）、`available_commands`、`current_mode_update` 等 |
| `session/request_permission` | 工具审批请求：options 为 `allow_once/allow_always/reject_once/reject_always` 四种，附 toolCall（rawInput、标题、kind、位置） |
| `fs/read_text_file` / `fs/write_text_file` | Agent 委托客户端读写文件（initialize 时声明的能力） |

**initialize 响应即能力声明**：`protocolVersion`、`capabilities.loadSession`、`promptCapabilities`（image/audio/embeddedContext）、`mcpCapabilities`（stdio/http/sse）、`sessionCapabilities`（fork/resume/list/close，键存在即支持）、`agentInfo`（name/version）、`auth_methods[]`。`session/new` 响应补充 `configOptions`、`modes`、`models`、`stopReason` 与 `usage`（token 用量）。

### 4.3 Claude 的非标准分叉

`ProcessAcpClient.forkSession` 保留了一个有价值的教训：Claude 不支持标准 `session/fork`，AionUi 用 `session/new` + Claude 私有 `_meta.claudeCode.options.resume` + 非标准 `forkSession: true` 参数变通，并注明"Claude-only and non-portable"。统一协议下仍有私有扩展缝隙，Driver 层要为这类缝隙留出口（ACP 本身用 `_meta` 和 `extMethod` 容纳扩展）。

## 五、进程与会话运行时

### 5.1 ProcessAcpClient：子进程生命周期单责管理

`src/process/acp/infra/ProcessAcpClient.ts` 是"一个本地 Agent 子进程 + 其 ACP 协议"的唯一所有者，工程细节密度最高：

- **4 信号生命周期检测**：`exit`、`close`、`stdout.close`、SDK connection abort 四个信号都可能指示 Agent 退出，first-write-wins 幂等记录 `AgentExitInfo`（exitCode、signal、reason、stderr、`unexpectedDuringPrompt`——是否在活动 prompt 中崩溃，决定已产出内容是否可信）；
- **stderr 环形缓冲**（8KB）：从 spawn 时刻开始捕获，退出时随错误一起带出，这是"保留诊断信息"的实现；
- **启动失败监视器**：`Promise.race(initialize, 进程退出)`，把"启动即崩溃"与"握手超时"区分开；SDK 抛的笼统 "ACP connection closed" 被归一化为带 stderr 和退出码的 `AgentStartupError`；
- **pending 请求追踪**：所有协议调用注册在 Set 中，断连时统一 reject 为 `AgentDisconnectedError`，而非各处超时；
- **三阶段优雅关闭**：`gracefulShutdown(child, gracePeriod)`（stdin close → 等待 → kill）；
- **bunx 缓存损坏自愈**：stderr 匹配 `Cannot find package/module` 时解析出缓存路径，校验其位于 BUN_TMPDIR/BUN 安装缓存白名单内（防止恶意 Agent 伪造 stderr 诱导任意目录删除）后清除重装。

### 5.2 AcpRuntime：会话池与空闲回收

`src/process/acp/runtime/AcpRuntime.ts` 管理全部活动会话（`Map<convId, SessionEntry>`）：

- **IdleReclaimer**：默认 5 分钟空闲超时、30 秒巡检，回收不活跃会话的子进程；
- **会话状态机**：`idle → starting → active → prompting → resuming → suspended / error`；
- **统一信号出口**：status_change、config_update、model_update、mode_update、context_usage（上下文用量）、permission_request、auth_required、error（含 recoverable 标志）、session_expired；
- **关闭语义**：应用退出时对活动会话执行 suspend 而非硬杀，保留可恢复性。

### 5.3 AuthNegotiator：认证协商

`src/process/acp/session/AuthNegotiator.ts` 的策略是 Fouc "凭据边界"的参考：**凭据只通过子进程环境变量注入（spawn 时），协议上只传选中的 methodId，不在协议载荷中传秘密**。协商逻辑：initialize 响应的 `auth_methods` 里找 `type: 'env_var'` 且所需变量全部就绪的方法；找不到匹配就跳过 authenticate（Agent 可能内部自行处理认证，如 Claude 的 OAuth 登录态）；认证失败抛 `AUTH_REQUIRED`（retryable），由 UI 引导用户进入 Agent 原生认证流程。

### 5.4 PermissionResolver：三级权限决策

`src/process/acp/session/PermissionResolver.ts` 决定 `request_permission` 的处理路径：

1. **YOLO 模式**：配置项开启时自动选择第一个 `allow_*` 选项（全量自动批准）；
2. **审批缓存**：LRU（默认 500 条），键为 `{kind, title, rawInput 中的 command/path/file_path}`（批准的是命令和路径，不是描述文本——防止换个描述就绕过记忆）；只有 `allow_*always` 决策入缓存，拒绝永不缓存；
3. **UI 委托**：挂起 Promise，向 UI 推送审批卡片（标题、kind、位置、rawInput、选项），等待用户选择后 resolve。

## 六、连接测试、健康检查与 Hub

### 6.1 两阶段连接测试

2.x 前端 `ipcBridge.acpConversation.testCustomAgent` 暴露的契约（实现在 AionCore）是用户添加自定义 Agent 时的"测试连接"：

```text
POST /api/agents/custom/try-connect
请求 { command, acp_args?, env?, runtime_scope_id? }
响应 { step: 'success' }
    | { step: 'fail_cli',  error }   # CLI 进程都没起来（命令不存在、参数错误）
    | { step: 'fail_acp',  error }   # 进程起来了但 ACP 握手失败（版本不支持 ACP 等）
```

两阶段把"CLI 层失败"与"协议层失败"分开，对应不同的修复动作（装 CLI / 换版本）。相关 API 还有：`POST /api/agents/{id}/health-check`（单个纳管 Agent 健康检查）、`POST /api/agents/provider-health-check`（厂商级）、`POST /api/agents/refresh`（刷新检测）、`GET /api/agents/management`（管理视图，含被禁用和丢失的行，用于诊断）、`PATCH /api/agents/{id}/enabled`、`GET|PUT /api/agents/{id}/overrides`（用户对内置目录的覆盖）。

### 6.2 启动错误翻译

1.x `AcpConnection.buildStartupErrorMessage` 把原始 stderr 翻译成可操作建议，模式值得整体迁移：

- 退出码 0 且无 stderr → "CLI 版本不支持 ACP 模式，请升级"（CLI 不认识 ACP 参数时打印帮助后正常退出的典型形态）；
- stderr 匹配 `not recognized|not found|No such file|command not found|ENOENT` → "CLI 未安装，请安装或在设置中修正路径"；
- stderr 匹配 `error loading config` → 提取配置文件路径，"请检查或临时重命名该配置"。

### 6.3 Hub 扩展机制

Agent 以扩展形式上架 Hub（`packages/desktop/src/common/types/agent/hub.ts`）：索引声明 `contributes.acpAdapters` 等 8 类贡献点；扩展是带 SHA-512 SRI 完整性校验的 tarball；API 为 `GET /api/hub/extensions`、`install/uninstall/retry-install/check-updates/update` + `hub.state-changed` WebSocket 事件；安装完成后自动刷新 Agent 目录（onInstall 钩子可能安装了新 CLI）。Hub 同时承担内置 Agent 的"引导安装"入口（未安装的 Agent 显示为一键安装项）。

### 6.4 环境工程（跨平台坑位全集）

`src/process/agent/acp/acpConnectors.ts` 的 `prepareCleanEnv` 与 spawn 重试链集中了 Electron/Node 生态跑外部 CLI 的全部已知坑，Fouc 在 Tauri 上会遇到同族问题：

| 坑 | AionUi 的处置 |
|---|---|
| GUI 进程拿不到 login shell 的 PATH/环境变量 | `loadFullShellEnvironment()`（登录 shell 环境）与 `getEnhancedEnv()`（PATH 合并、内置工具注入）合并为基线 |
| Electron 注入的 `NODE_OPTIONS` 干扰子 Node 进程 | 删除 NODE_OPTIONS/NODE_INSPECT/NODE_DEBUG |
| 从 Claude Code 里启动 AionUi 时的嵌套会话检测 | 删除 `CLAUDECODE` 环境变量 |
| `npm start` 继承的 `npm_*` lifecycle 变量干扰 npx | 前缀 `npm_` 全部剥除 |
| Windows Defender 扫描 %TEMP% 导致 bun/npx 文件操作 EPERM | bun 缓存与 TMP/TEMP 全部重定向到 userData 目录 |
| npx 桥接包冷启动慢 | 两阶段策略：先 `--prefer-offline`（1-2s），失败再全量 registry 查询（3-5s） |
| bunx 缓存损坏（传递依赖丢失） | 识别 → 白名单校验路径 → 清缓存重试 |
| Node 版本过旧导致 `#!/usr/bin/env node` 的 CLI 崩溃 | spawn 前检查 Node ≥ 18.17，自动修正 PATH |
| POSIX 上父进程退出拖死子进程 | 非 Windows `detached: true` + `unref()`，终止时进程组 kill |

## 七、AionCore 相对 1.x 的关键演进（本地源码核实）

将 AionCore 与 1.x 逐主题对照后，确认 2.x 在以下六个方面是实质演进而非简单平移——这些演进直接决定 Fouc 的参考策略（见配套设计文档）：

### 7.1 桥接运行时：npx → bun x + 受管 bun

1.x 用 `npx <bridge>` 启动 ACP 桥并为此堆了两阶段重试（`--prefer-offline` 优先）、bunx 缓存清理、Defender EPERM 等待等补丁。AionCore 的目录种子显示桥启动已统一为 **`bun x --bun <pkg>@<version>`**（如 codex 行：`command='bun', args=["x","--bun","@zed-industries/codex-acp@0.9.5"]`；claude 行同构），配合 `aionui-runtime/src/node_runtime/managed` 的**受管 bun 运行时**（打包自带、装到 `{data_dir}/runtime`，不依赖用户机器的 Node/Bun）。这把"桥需要 Node"这个 1.x 的隐式依赖变成了确定性的自带运行时，同时大幅消化了 npx 生态坑。配套机制：`registry_npx_lock`（registry 包版本锁）与 `corrupt_npx_cache_repair`（缓存损坏检测与定向修复）。

### 7.2 探测策略：单发探测 → 双预算分级

`aionui-ai-agent/src/cli_probe.rs` 把 1.x 的"跑一次 `--version` 看结果"进化为策略化探测：

- **inline 预算 5s / 后台 recheck 预算 30s**：启动路径上的探测超时**不定罪**（"slow load, not proof of corruption"），转入后台复查；
- **慢代理白名单**：持久化的启动快照显示探测慢于 2s 的 Agent，下次直接跳过 inline 探测（后端就绪时间不为已知慢 CLI 买单）；
- **失败分类**：`command_not_found` / `version_probe_failed`（快速确定性失败=疑似损坏安装）/ `version_probe_timeout`（健康但慢）三态分开，不允许合并成同一个"不可用"；
- **探测产出留存**：`--version` 的首个非空行作为 `reported_version` 带回（避免为拿版本号二次起进程），静默成功的 CLI 报 `None` 而非空串（防空版本误判漂移）；
- **npx 桥跳过版本探测**：builtin + bridge=npx 的 Agent 有 registry 锁保护时跳过（版本由锁保证）。

### 7.3 注册中心：内存态 → DB 持久化目录 + 目录同步通道

1.x 的 AgentRegistry 每次启动重新检测、状态在内存。AionCore 的 `registry.rs`（2274 行）是持久化目录中心：`agent_metadata` 表为源头，启动时 hydrate 到内存快照（`by_id` RwLock），探测并发度 8；会话握手产生的能力更新经 **MPSC catalog 通道**（容量 256、单写线程消费）串行化落库，避免多会话并发写同一行；`UnavailableReason` 独立维护每个不可用 Agent 的原因分类。

### 7.4 启动失败处理： stderr 语义化与"不泄漏给客户端"

`manager/acp/agent.rs`（2327 行）的启动错误处理比 1.x 精细一档：启动崩溃（exit/signal）与握手超时分开归因；失败时 `peek_stderr_tail` 取 stderr 尾部行做诊断；**stderr 只进自家日志、不折进返回给客户端的错误**（注释明言"may contain sensitive paths"——脱敏意识落在工程上）；cc-switch（Claude 供应商切换工具）的环境变量在 spawn 时定向注入。

### 7.5 行为差异目录化：`behavior_policy`

Claude 的非标准行为不再是散落的代码注释，而是目录行上的结构化开关，例如 claude 行的 `behavior_policy = {"supports_side_question":true, "self_identity_sticky":true, "session_load_via_meta_field":true, "supports_team":true}` 与 `yolo_id = 'bypassPermissions'`。**Agent 间的私有协议缝隙（如 Claude 用 `_meta` 字段做会话恢复）被显式建模为数据**，Driver 逻辑读策略而不写死分支。

### 7.6 会话状态：reducer 模式

`aionui-session` 用 state/reducer/event 的组合管理会话状态（`state.rs`、`reducer.rs`、`event.rs`、`adapter/backend` 双后端适配），把"直连 CLI"与"ACP"两种后端折叠到同一状态机上——这是 1.x 时代 AcpRuntime 状态机的结构化升级。

### 7.7 对 Fouc 参考策略的结论

| 主题 | 参考对象 | 理由 |
|---|---|---|
| 连接/检测/会话/审批的**实现逻辑** | **1.x（TS）为主** | 同语言同 SDK（`@agentclientprotocol/sdk`），结构最简表达，可直接移植；Fouc 后端确定走 TS |
| **工程策略与坑位的最新解** | **AionCore（Rust）为权威** | bun x 桥启动行、双预算探测、慢代理白名单、npx 锁与缓存自修复、behavior_policy 目录化、stderr 脱敏边界——这些是 1.x 冻结后一年多的持续踩坑产出 |
| 产品域模型（错误码/健康快照/管理视图） | 2.x 前端契约（语言无关） | `AgentMetadata`、四时机健康检查、错误码 → i18n 体系 |

一句话：**1.x 是"Fouc TS 后端"的直系原型，AionCore 是"哪里又踩了坑、现在怎么解"的权威答案**。两者不是二选一，而是分层使用；AionCore 中大量 Fouc 用不到的域（teams、cron、channel、office、webui auth）跳过即可。

## 八、评价：对 Fouc 的价值与局限

### 8.1 值得吸收的核心资产

1. **ACP 作为统一协议基座的架构决策**——把"每个 CLI 一套私有适配"变成"目录里一行声明"，且天然覆盖 Fouc 首批三个 Agent（Codex/Claude/OpenCode），并附带 tool_call 事件、权限审批、计划、用量等结构化能力，直接满足 Fouc L3 要求；
2. **发现—注册—探测—监督的分层**：AcpDetector（纯检测）/ AgentRegistry（状态编排）/ ProcessAcpClient（进程单责）/ AcpRuntime（会话池）职责边界干净，与 Fouc 规划的 Discovery/Registry/Capability/Driver Router/Session Supervisor 几乎一一对应；
3. **能力来自握手的坚持**：handshake 留存、健康快照四时机、错误码 + 修复引导，是"状态应显示原因与修复入口"的完整落地；
4. **大量实测淬炼出的平台细节**：批量 PATH 检测、双阶段连接测试、错误翻译模式、环境坑位表——这些是踩过坑才能写出来的，直接继承可以省掉 Fouc 数月的平台适配返工。

### 8.2 与 Fouc 需求的差距（不能照搬的部分)

| AionUi 的取舍 | Fouc 的要求 | 差距 |
|---|---|---|
| 聊天会话为中心（conversation 驱动） | WorkObject/TaskContract 驱动，AgentSession/AgentRun 绑定工作对象、用户、权限与审计 | 会话与运行对象需要重新设计，纳入 Fouc 领域模型 |
| 状态主要在内存 + 部分 SQLite，重启后会话恢复不完整（1.x 归档中 acp_session 持久化被注释禁用，注释承认 agent_id 语义错误且无读取方） | F4 持久化运行时，重启可恢复或明确不可恢复 | 持久化与恢复语义要按 Fouc 标准重写 |
| 权限模型即 YOLO/缓存/弹窗三级，无风险分级、无 Delegation | F3 五级风险（read/modify-local/write-remote/push/release）+ 委托与策略 | PermissionResolver 的缓存机制可借鉴，决策链必须接入 Fouc 策略中心 |
| 静默重试链（清缓存、重装桥包）偏"自愈优先" | 安装/升级/网络拉取必须是显式用户动作 | 自愈策略需收敛为白名单内的诊断提示 + 用户确认 |
| 检测即信任（`cursor` 用 `which agent` 检测，注释自己承认歧义；扩展 agent 不校验） | 不能仅凭文件名/声明视为可信 Agent，需无副作用探测确认身份 | Fouc 的 probe 必须做身份校验（版本/帮助探测）而非仅存在性检查 |
| 1.x 为 Electron 单体，进程与 UI 同生命周期；2.x 前后端已分进程但后端是 Rust | Fouc：Next.js 前端 + TS sidecar 后端 + Tauri 薄壳 | 进程拓扑不同；协议层 1.x TS 实现可近乎直接移植（见配套设计文档） |
| npx 桥依赖隐式网络拉取（2.x 已部分解决：bun x + 受管运行时 + registry 锁，见 §7.1） | 供应链与确定性要求 | 桥包固定版本、校验完整性、显式安装；AionCore 的锁与自修复机制可借鉴 |

### 8.3 一句话总结

AionUi 证明了"用 ACP + 声明式目录 + 握手探测"可以把数十个本机 CLI Agent 纳入统一管理，并把其中最难的跨平台进程工程打磨成熟；Fouc 的后端已确定用 TS 实现，因此以 1.x TS 实现为主参考（同语言同 SDK、可直接移植），以 AionCore 为工程策略与最新坑位解法的权威参照（bun x 桥、双预算探测、缓存自修复、行为策略目录化），而在持久化语义、权限模型、工作对象绑定与安全边界上按自己的产品标准重新设计。
