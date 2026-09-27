# F0 Agent 控制面：与 AionUi 1.x 的能力对齐清单

> 状态基线：2026-08-31，F0 核心已落地（发现/探测/能力清单/会话/运行/事件/审批协议层），
> 真机验证 claude-code / codex / opencode 三个真实安装。
> 本文件记录**尚未对齐的能力**与处置决策，作为后续迭代的权威清单。

## 一、引擎类型差距（V2 范围，设计文档 AD-1 已留扩展位）

AionUi 1.x 同时支持 5 种执行引擎（kind），Fouc V1 只实现 ACP 一种。裁掉的部分：

| 引擎 | 1.x 体量 | 说明 | 处置 |
|---|---|---|---|
| gemini 内嵌引擎 | ≈4,770 行 | Gemini CLI 不走 ACP；AionUi 将 `@google/gemini-cli` 作为库嵌入自进程，含 OAuth token 管理、内嵌工具（图片生成等）、设置体系、流恢复 | V1 不做。若 Gemini CLI 未来提供 ACP 模式，目录加一行声明即可接入；否则需移植 OAuth 管理子系统，等真实需求再决策 |
| openclaw 网关 | ≈2,080 行 | OpenClaw Gateway 的 WebSocket 网关协议 | V2 远程纳管范围 |
| remote 远程 Agent | 705 行 | RemoteAgentCore：远程 WebSocket Agent 的配置管理面（协议/认证/remote_agents 表）。**ACP-over-WebSocket 传输层已保留**（backend `transport.ts` 的 `fromWebSocket`） | V2：补配置面 + remote agent 表即可启用 |
| aionrs 自研引擎 | 473 行 | AionUi 私有 Rust 引擎 | 永不迁移（Fouc 不自研引擎） |

## 二、1.x 新轨已有、Fouc 尚未移植的能力

| 能力 | 1.x 位置 | 状态 | 处置 |
|---|---|---|---|
| 空闲回收 IdleReclaimer | `acp/runtime/IdleReclaimer.ts` | 已实现并真机验证（默认 10 分钟、`FOUC_IDLE_TIMEOUT_MS` 可调；挂起后新消息自动唤醒，30s 巡检跳过 prompting/审批中会话） | 已对齐 |
| 重启后会话恢复 | AcpRuntime 从 DB 重建 | 已实现并真机验证（启动扫描置 suspended、`POST /api/sessions/:id/resume`、loadSession 失败透明降级新建） | 已对齐 |
| AcpMetrics 性能埋点 | `acp/metrics/` | 未实现 | 等性能调优需求出现再补（spawn 延迟/错误计数） |
| 用户 MCP 服务器接入 | `McpConfig.fromStorageConfig` | 未实现 | Fouc 尚无 MCP 配置存储体系；待 F6 连接器控制面落地后接入 |
| warmup 预热 | `warmup_session` | 未实现 | 启动性能优化项，非功能缺口 |
| 会话分叉完整暴露 | `forkSession`（Claude `_meta` 私有参数） | 协议方法已在 client，未暴露 API | 等 Work Room 需要“从某点重放”时暴露 |
| 旧轨 AcpConnection + compat 层 | 1,162 + ≈1,400 行 | **不迁移** | 1.x 新旧双轨过渡代码；Fouc 纯净原则禁止 |

## 三、F0 验收场景对照（core-features.md / local-agent-management.md §十二）

| # | 场景 | 状态 |
|---|---|---|
| 1 | 只装 OpenCode 的机器自动识别并可直接建会话 | ✅ 真机验证（发现→探测→会话→流式回复→token 用量） |
| 2 | 多版本共存、不混淆路径与会话 | ⚠️ 数据模型支持（installation 按 provider+路径摘要唯一），未做多版本真机验证 |
| 3 | Claude 未登录 → needs_auth + 原生认证引导 | ✅ 状态语义真机验证；原生认证引导 UI 待补（当前仅错误文案） |
| 4 | 高风险工具审批在 Work Room 呈现，未批准不推进 | ✅ 审批往返经 Mock ACP Agent（真实子进程/NDJSON/SDK）8 项断言验证：UI 委托、outcome 回写、allow_once 不缓存、allow_always 缓存重放（`bun backend/device/scripts/verify-approval.ts` 可重复） |
| 5 | 取消长任务：优雅取消 → 确认进程状态 → 保留输出 | ✅ cancel API + 事件保留实现；cancel 后进程状态确认 UI 待补 |
| 6 | Agent 升级事件格式变化 → 标记不兼容不误判 | ⚠️ 指纹机制已实现（capability fingerprint），未做升级演练验证 |
| 7 | Fouc 重启：恢复可恢复会话或明确不可恢复原因 | ✅ 真机验证：重启后 suspended 且 nativeSessionId 保留，resume → active（OpenCode 实测 loadSession 成功） |

## 四、其他已知边界

- 桥接包首次使用需联网下载（bun x 冷启动，探测预算已放宽到 90s）；完全离线场景需预装桥缓存，属分发工程问题
- Windows `.cmd` shim 的多层包装解析（npm shim → node → 真实二进制）只做了单层归一化，未做深度解析
- 会话工作目录当前由调用方任意指定；F2 隔离工作区（worktree 强制）落地后需收紧为仅允许登记过的工作区
- `cursor` Provider 的命令名 `agent` 存在同名歧义（1.x 目录注释自认），靠探测身份校验兜底，未真机验证
