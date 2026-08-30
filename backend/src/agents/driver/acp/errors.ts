/**
 * @license
 * 错误体系移植自 AionUi (aionui.com) 的 src/process/acp/errors/
 * （AcpError.ts / errorNormalize.ts / errorExtract.ts，Apache-2.0），
 * Copyright 2025 AionUi (aionui.com)，按 Apache-2.0 授权复用并修改。
 */

import { RequestError } from '@agentclientprotocol/sdk';

export type AcpErrorCode =
  | 'CONNECTION_FAILED'
  | 'AUTH_FAILED'
  | 'AUTH_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'PROMPT_TIMEOUT'
  | 'PROCESS_CRASHED'
  | 'INVALID_STATE'
  | 'INTERNAL_ERROR'
  | 'ACP_PARSE_ERROR'
  | 'INVALID_ACP_REQUEST'
  | 'ACP_METHOD_NOT_FOUND'
  | 'ACP_INVALID_PARAMS'
  | 'AGENT_INTERNAL_ERROR'
  | 'ACP_SESSION_NOT_FOUND'
  | 'AGENT_SESSION_NOT_FOUND'
  | 'ACP_ELICITATION_REQUIRED'
  | 'ACP_REQ_CANCELLED'
  | 'AGENT_ERROR';

export class AcpError extends Error {
  readonly retryable: boolean;

  constructor(
    public readonly code: AcpErrorCode,
    message: string,
    options?: { cause?: unknown; retryable?: boolean }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AcpError';
    this.retryable = options?.retryable ?? false;
  }
}

/** spawn() 本身失败（命令不存在、权限拒绝等） */
export class AgentSpawnError extends AcpError {
  constructor(
    public readonly agentCommand: string,
    cause?: unknown
  ) {
    const msg = `Failed to spawn agent "${agentCommand}": ${cause instanceof Error ? cause.message : String(cause)}`;
    super('CONNECTION_FAILED', msg, { cause, retryable: true });
    this.name = 'AgentSpawnError';
  }
}

/** initialize 完成前进程退出（附 stderr 与退出码） */
export class AgentStartupError extends AcpError {
  constructor(
    public readonly agentCommand: string,
    public readonly exitCode: number | null,
    public readonly signal: string | null,
    public readonly stderrSummary: string,
    cause?: unknown
  ) {
    const exitSummary = signal ? `signal: ${signal}` : `code: ${exitCode}`;
    const stderrSuffix = stderrSummary ? `\n${stderrSummary}` : '';
    super('PROCESS_CRASHED', `Agent exited before initialize completed (${exitSummary})${stderrSuffix}`, {
      cause,
      retryable: true,
    });
    this.name = 'AgentStartupError';
  }
}

/** 活动请求期间进程死亡（附退出信息） */
export class AgentDisconnectedError extends AcpError {
  readonly outputAlreadyEmitted: boolean;

  constructor(
    public readonly reason: string,
    public readonly exitCode: number | null,
    public readonly signal: string | null,
    options?: { cause?: unknown; outputAlreadyEmitted?: boolean }
  ) {
    const exitSummary = signal ? `signal: ${signal}` : `code: ${exitCode}`;
    super('PROCESS_CRASHED', `Agent disconnected (${reason}, ${exitSummary})`, {
      cause: options?.cause,
      retryable: true,
    });
    this.name = 'AgentDisconnectedError';
    this.outputAlreadyEmitted = options?.outputAlreadyEmitted ?? false;
  }
}

// ─── JSON-RPC 错误码映射 ───────────────────────────────────────────

const ACP_CODE_MAP: Record<number, { code: AcpErrorCode; retryable: boolean }> = {
  [-32700]: { code: 'ACP_PARSE_ERROR', retryable: true },
  [-32600]: { code: 'INVALID_ACP_REQUEST', retryable: false },
  [-32601]: { code: 'ACP_METHOD_NOT_FOUND', retryable: false },
  [-32602]: { code: 'ACP_INVALID_PARAMS', retryable: false },
  [-32603]: { code: 'AGENT_INTERNAL_ERROR', retryable: true },
  [-32000]: { code: 'AUTH_REQUIRED', retryable: true },
  [-32001]: { code: 'ACP_SESSION_NOT_FOUND', retryable: false },
  [-32002]: { code: 'AGENT_SESSION_NOT_FOUND', retryable: false },
  [-32042]: { code: 'ACP_ELICITATION_REQUIRED', retryable: false },
  [-32800]: { code: 'ACP_REQ_CANCELLED', retryable: false },
};

const RETRYABLE_ERRNO = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT']);

const AUTH_KEYWORDS_RE =
  /\btoken\s+(is\s+)?expired\b|\bsso\s+login\b|\bunauthorized\b|\bforbidden\b|\bcredential\b|\bapi[_ ]?key\b|\bnot\s+authenticated\b|\baccess\s+denied\b/i;

export function normalizeError(error: unknown): AcpError {
  if (error instanceof AcpError) return error;

  if (error instanceof Error) {
    const errno = (error as NodeJS.ErrnoException).code;
    if (errno && RETRYABLE_ERRNO.has(errno)) {
      return new AcpError('CONNECTION_FAILED', error.message, { cause: error, retryable: true });
    }
  }

  if (error instanceof RequestError) {
    const mapped = ACP_CODE_MAP[error.code];
    // 部分 Agent 用 -32603 而非 -32000 返回认证失败；用消息启发式纠正，
    // 以便向用户呈现正确的认证引导流程。
    if (mapped && mapped.code !== 'AUTH_REQUIRED' && isAuthRelatedMessage(error.message)) {
      return new AcpError('AUTH_REQUIRED', error.message, { cause: error, retryable: true });
    }
    if (mapped) {
      return new AcpError(mapped.code, error.message, { cause: error, retryable: mapped.retryable });
    }
    return new AcpError('AGENT_ERROR', error.message, { cause: error });
  }

  // SDK 的 "ACP connection closed"：子进程在响应前退出，按可重试的崩溃处理
  if (error instanceof Error && /ACP connection closed/i.test(error.message)) {
    return new AcpError('PROCESS_CRASHED', error.message, { cause: error, retryable: true });
  }

  const acpPayload = extractAcpError(error);
  if (acpPayload) {
    const mapped = ACP_CODE_MAP[acpPayload.code];
    if (mapped) {
      return new AcpError(mapped.code, acpPayload.message, { cause: error, retryable: mapped.retryable });
    }
    return new AcpError('AGENT_ERROR', acpPayload.message, { cause: error });
  }

  return new AcpError('INTERNAL_ERROR', formatUnknownError(error), { cause: error });
}

export function isRetryablePromptError(error: unknown): boolean {
  if (error instanceof AcpError) return error.retryable;
  return normalizeError(error).retryable;
}

function isAuthRelatedMessage(message: string): boolean {
  return AUTH_KEYWORDS_RE.test(message);
}

// ─── 递归错误载荷提取 ──────────────────────────────────────────────

const MAX_DEPTH = 5;

export type AcpErrorPayload = {
  code: number;
  message: string;
  data?: unknown;
};

export function extractAcpError(error: unknown, depth = 0): AcpErrorPayload | null {
  if (depth > MAX_DEPTH || error == null || typeof error !== 'object') return null;

  const obj = error as Record<string, unknown>;
  if (typeof obj.code === 'number' && typeof obj.message === 'string') {
    return { code: obj.code, message: obj.message, ...(obj.data !== undefined ? { data: obj.data } : {}) };
  }

  for (const key of ['error', 'cause', 'acp'] as const) {
    if (obj[key] != null) {
      const found = extractAcpError(obj[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function formatUnknownError(error: unknown): string {
  if (error == null) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error && typeof (error as Record<string, unknown>).message === 'string') {
    return (error as Record<string, unknown>).message as string;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
