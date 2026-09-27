/**
 * @license
 * 会话域类型移植自 AionUi (aionui.com) 的 src/process/acp/types.ts
 * （Apache-2.0），Copyright 2025 AionUi (aionui.com)，
 * 按 Apache-2.0 授权复用并修改。事件输出端换为 Fouc 标准事件流。
 */

import type {
  AuthMethod,
  ContentBlock,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@agentclientprotocol/sdk';
import type { AgentEvent, ConfigOptionDto, ModeSnapshotDto, ModelSnapshotDto, ToolKindDto } from '@fouc/shared';

export type PromptContent = ContentBlock[];

// ─── 会话状态机（7 态 FSM） ────────────────────────────────────────

export type SessionStatus = 'idle' | 'starting' | 'active' | 'prompting' | 'suspended' | 'resuming' | 'error';

// ─── 认证与信号 ────────────────────────────────────────────────────

export type AuthRequiredData = {
  agentBackend: string;
  methods: AuthMethod[];
};

export type SessionSignal =
  | { type: 'turn_finished'; stopReason?: string | null; usage?: { totalTokens?: number } | null }
  | { type: 'session_expired' }
  | { type: 'auth_required'; auth: AuthRequiredData }
  | { type: 'error'; message: string; recoverable: boolean };

// ─── 权限 UI 数据 ─────────────────────────────────────────────────

export type PermissionUIData = {
  callId: string;
  title: string;
  description: string;
  kind?: ToolKindDto;
  options: Array<{
    optionId: string;
    label: string;
    kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
  }>;
  locations?: Array<{ path: string; range?: { startLine: number; endLine?: number } }>;
  rawInput?: unknown;
};

// ─── 会话回调（Session → 上层） ───────────────────────────────────

export type SessionCallbacks = {
  onInitialize?: (result: unknown) => void;
  /** Fouc 标准事件（message.delta / tool.* / plan.updated ...） */
  onEvent: (event: AgentEvent) => void;
  onSessionId: (sessionId: string) => void;
  onStatusChange: (status: SessionStatus) => void;
  onModelUpdate: (model: ModelSnapshotDto) => void;
  onModeUpdate: (mode: ModeSnapshotDto) => void;
  onConfigUpdate: (options: ConfigOptionDto[]) => void;
  onContextUsage: (usage: { used: number; total: number; percentage: number }) => void;
  onPermissionRequest: (data: PermissionUIData) => void;
  onSignal: (event: SessionSignal) => void;
};

// ─── 协议处理器（SDK 反向回调） ───────────────────────────────────

export type ProtocolHandlers = {
  onSessionUpdate: (notification: SessionNotification) => void;
  onRequestPermission: (request: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  onReadTextFile: (request: ReadTextFileRequest) => Promise<ReadTextFileResponse>;
  onWriteTextFile: (request: WriteTextFileRequest) => Promise<WriteTextFileResponse>;
};

/** 临时连接（连接测试、健康检查）用的空处理器 */
export const noopProtocolHandlers: ProtocolHandlers = {
  onSessionUpdate: () => {},
  onRequestPermission: () => Promise.resolve({ outcome: { outcome: 'cancelled' as const } }),
  onReadTextFile: () => Promise.resolve({ content: '' }),
  onWriteTextFile: () => Promise.resolve({}),
};

// ─── Agent 连接配置（由 Provider + Installation 解析得到） ────────

export type AgentConnectionConfig = {
  agentBackend: string;
  /** Fouc 会话 id（事件流的 sessionId 字段来源） */
  foucSessionId: string;
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  mcpServers?: Array<{ name: string; command?: string; args?: string[]; env?: Array<{ name: string; value: string }> }>;
  additionalDirectories?: string[];
  authCredentials?: Record<string, string>;
  resumeSessionId?: string;
  yoloMode?: boolean;
  behaviorPolicy: {
    sessionLoadViaMetaField?: boolean;
    yoloModeId?: string | null;
  };
  gracePeriodMs?: number;
};
