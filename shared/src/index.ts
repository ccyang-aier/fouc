/**
 * Fouc 前后端共享契约 —— API 类型与领域事件的唯一事实源。
 *
 * 本包不依赖任何运行时框架（Hono / Bun / Next / Tauri），仅包含纯类型、
 * 常量与纯函数，保证前端与后端各自演进时契约稳定。
 */

// ─── Agent Provider（一类 Agent 产品的目录声明） ───────────────────

/**
 * ACP 启动方式：原生子命令，或桥接。
 * 桥的本地化工件按形态区分：开发态统一解析 backend/node_modules 下的 entry
 * （js 经 bun 运行，native 直接执行）；打包态由 packaged 声明来源——
 * 并入后端二进制（argv 分发），或首次使用时从 npm 下载原生桥。
 */
export type AcpLaunch =
  | { kind: 'native'; args: string[] }
  | {
      kind: 'bridge';
      /** 开发态工件形态：bun 可运行的 js 入口，或 npm 平台包内的原生二进制 */
      devRuntime: 'bun' | 'native';
      /** backend/node_modules 下的工件路径（存在即视为开发态） */
      devEntry: string;
      packaged:
        | { source: 'backend-dispatch' }
        | { source: 'npm-download'; npmPackage: string; version: string; bin: string };
    };

/** 目录中一个 Provider 的声明（对应 SQLite agent_provider 种子行） */
export interface ProviderSpec {
  id: string;
  name: string;
  cliCommand: string;
  acpLaunch: AcpLaunch;
  authRequired: boolean;
  skillsDir: string | null;
  defaultEnabled: boolean;
  behaviorPolicy: {
    /** 会话恢复走 Claude 私有 _meta 字段 */
    sessionLoadViaMetaField?: boolean;
    /** 全自动（YOLO）模式对应的原生 mode id */
    yoloModeId?: string | null;
  };
}

// ─── AgentInstallation（本机一个真实安装实例） ──────────────────────

export type InstallationStatus =
  | 'unchecked' // 已发现候选，尚未探测
  | 'ready' // 身份确认、协议兼容、可启动会话
  | 'needs_auth' // 程序可用，但原生登录/凭据未就绪
  | 'needs_runtime' // 桥接所需运行时（bun/node）缺失
  | 'incompatible' // 已识别，但协议版本不被支持
  | 'unhealthy' // 探测超时、启动失败或输出异常
  | 'disabled' // 用户主动停用
  | 'missing'; // 此前登记的路径当前不可用

export type InstallationSource = 'path' | 'known_location' | 'user_added' | 'package_manager';

export interface AgentInstallation {
  id: string;
  providerId: string;
  executablePath: string;
  source: InstallationSource;
  version: string | null;
  status: InstallationStatus;
  capabilityManifest: CapabilityManifest | null;
  lastProbeAt: number | null;
  lastProbeKind: ProbeKind | null;
  lastProbeDurationMs: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorGuidance: string | null;
  enabled: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ProbeKind = 'startup' | 'scheduled' | 'manual' | 'session';

// ─── CapabilityManifest（探测握手产生的真实能力清单） ───────────────

export type AdapterLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface CapabilityManifest {
  adapterLevel: AdapterLevel;
  protocol: { kind: 'acp'; version: number };
  agentName: string | null;
  version: string | null;
  session: { resume: boolean; fork: boolean; list: boolean; close: boolean };
  input: { image: boolean; audio: boolean; embeddedContext: boolean };
  controls: {
    models: Array<{ id: string; name: string; description?: string }>;
    modes: Array<{ id: string; name: string; description?: string }>;
    configOptions: Array<{
      id: string;
      name: string;
      type: 'select' | 'boolean' | 'string';
      currentValue?: string | boolean;
      options?: Array<{ id: string; name: string; description?: string }>;
    }>;
  };
  extensions: { mcp: { stdio: boolean; http: boolean; sse: boolean }; skillsDir: string | null };
  events: string[];
  auth: { methods: Array<{ id: string; name: string }>; needsAuth: boolean };
  probedAt: number;
  fingerprint: string;
}

// ─── AgentSession / AgentRun ────────────────────────────────────────

export type SessionStatus = 'idle' | 'starting' | 'active' | 'prompting' | 'suspended' | 'resuming' | 'error' | 'ended';

export interface AgentSession {
  id: string;
  installationId: string;
  providerId: string;
  workDir: string;
  nativeSessionId: string | null;
  status: SessionStatus;
  createdAt: number;
  lastActiveAt: number;
  endedAt: number | null;
  endReason: string | null;
}

export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentRun {
  id: string;
  sessionId: string;
  seq: number;
  input: string;
  status: RunStatus;
  startedAt: number | null;
  endedAt: number | null;
  exitInfo: AgentExitInfoDto | null;
  stopReason: string | null;
  usage: TokenUsage | null;
}

export interface AgentExitInfoDto {
  exitCode: number | null;
  signal: string | null;
  reason: string;
  stderr: string;
  unexpectedDuringPrompt: boolean;
}

export interface TokenUsage {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

// ─── 统一事件流（ACP sessionUpdate → Fouc 标准事件） ────────────────

export type AgentEvent =
  | { type: 'session.started'; sessionId: string; nativeSessionId: string | null }
  | { type: 'session.status'; sessionId: string; status: SessionStatus }
  | { type: 'session.ended'; sessionId: string; reason: string }
  | { type: 'run.started'; sessionId: string; runId: string }
  | { type: 'run.completed'; sessionId: string; runId: string; stopReason: string | null; usage: TokenUsage | null }
  | { type: 'run.failed'; sessionId: string; runId: string; message: string; recoverable: boolean }
  | { type: 'run.cancelled'; sessionId: string; runId: string }
  | { type: 'message.delta'; sessionId: string; runId: string | null; role: 'agent'; msgId: string; text: string }
  | { type: 'thought.delta'; sessionId: string; runId: string | null; msgId: string; text: string }
  | { type: 'tool.started'; sessionId: string; runId: string | null; toolCallId: string; title: string; kind: ToolKindDto; rawInput?: unknown; locations?: Array<{ path: string }> }
  | { type: 'tool.updated'; sessionId: string; runId: string | null; toolCallId: string; title: string; kind: ToolKindDto; status: 'in_progress' | 'completed' | 'failed'; content?: ToolContentDto[]; rawOutput?: unknown }
  | { type: 'plan.updated'; sessionId: string; runId: string | null; entries: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed'; priority?: 'low' | 'medium' | 'high' }> }
  | { type: 'control.updated'; sessionId: string; model?: ModelSnapshotDto | null; mode?: ModeSnapshotDto | null; configOptions?: ConfigOptionDto[] }
  | { type: 'context.usage'; sessionId: string; usage: { used: number; total: number; percentage: number } }
  | { type: 'approval.required'; sessionId: string; runId: string | null; approval: ApprovalDto }
  | { type: 'approval.resolved'; sessionId: string; callId: string; outcome: string }
  | { type: 'installation.changed'; installation: AgentInstallation }
  | { type: 'auth.required'; sessionId: string; methods: Array<{ id: string; name: string }> };

export type ToolKindDto = 'read' | 'edit' | 'execute';

export type ToolContentDto =
  | { type: 'content'; text: string }
  | { type: 'diff'; path?: string; oldText?: string | null; newText?: string };

export interface ModelSnapshotDto {
  currentModelId: string | null;
  availableModels: Array<{ id: string; name: string; description?: string }>;
}

export interface ModeSnapshotDto {
  currentModeId: string | null;
  availableModes: Array<{ id: string; name: string; description?: string }>;
}

export interface ConfigOptionDto {
  id: string;
  name: string;
  type: 'select' | 'boolean' | 'string';
  currentValue?: string | boolean;
  options?: Array<{ id: string; name: string; description?: string }>;
}

export interface ApprovalDto {
  callId: string;
  title: string;
  kind?: ToolKindDto;
  options: Array<{ optionId: string; label: string; kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' }>;
  locations?: Array<{ path: string; range?: { startLine: number; endLine?: number } }>;
  rawInput?: unknown;
}

// ─── 错误码（面向用户修复动作，i18n 键） ───────────────────────────

export const AGENT_ERROR_CODES = [
  'command_not_found',
  'identity_mismatch',
  'version_probe_failed',
  'version_probe_timeout',
  'bridge_missing',
  'runtime_missing',
  'acp_init_failed',
  'incompatible_version',
  'auth_required',
  'process_crashed',
  'internal_error',
] as const;

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];

// ─── API 响应包 ─────────────────────────────────────────────────────

export interface ApiErrorBody {
  code: string;
  message: string;
  guidance?: string | null;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

// ─── WS 事件信封 ────────────────────────────────────────────────────

export interface WsEnvelope {
  /** 两级命名：域.动作，如 agents.installationChanged / runs.event */
  topic: string;
  payload: unknown;
  at: number;
}

export const WS_TOPICS = {
  installationChanged: 'agents.installationChanged',
  runEvent: (sessionId: string): string => `runs.event.${sessionId}`,
  sessionEvent: (sessionId: string): string => `sessions.event.${sessionId}`,
} as const;
