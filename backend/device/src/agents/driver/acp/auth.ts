/**
 * @license
 * 认证协商与权限决策分别移植自 AionUi (aionui.com) 的
 * src/process/acp/session/AuthNegotiator.ts 与 PermissionResolver.ts
 * （Apache-2.0），Copyright 2025 AionUi (aionui.com)，
 * 按 Apache-2.0 授权复用并修改。
 *
 * 认证：凭据只经子进程环境变量注入，协议上仅传选中的 methodId，
 * 秘密不出现在协议载荷中。
 *
 * 权限：三级决策 —— YOLO 自动批准 → "always allow" 缓存（LRU）→ UI 委托。
 * 缓存键为 kind+title+操作标识字段（批准命令与路径，不是描述文本）；
 * 只有 allow_*always 决策入缓存，拒绝永不缓存。
 */

import type { AuthMethod, RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk';
import { AcpError } from './errors';
import type { AuthRequiredData, PermissionUIData } from './types';

// ─── AuthNegotiator ────────────────────────────────────────────────

export class AuthNegotiator {
  private credentials: Record<string, string> | null = null;

  constructor(private readonly agentBackend: string) {}

  get hasCredentials(): boolean {
    return this.credentials !== null && Object.keys(this.credentials).length > 0;
  }

  mergeCredentials(creds: Record<string, string>): void {
    this.credentials = { ...this.credentials, ...creds };
  }

  getCredentials(): Record<string, string> | undefined {
    return this.credentials ?? undefined;
  }

  /** 选择最佳认证方法并经协议完成认证；无匹配凭证时跳过（Agent 可能内部自行处理） */
  async authenticate(protocol: { authenticate(methodId: string): Promise<unknown> }, authMethods?: AuthMethod[]): Promise<void> {
    const methods = authMethods ?? [];
    if (methods.length === 0) return;

    const selected = this.selectAuthMethod(methods);
    if (!selected) {
      return;
    }

    try {
      await protocol.authenticate(selected.id);
    } catch (err) {
      throw new AcpError('AUTH_REQUIRED', 'Authentication required', { cause: err, retryable: true });
    }
  }

  /** 选择首个所需变量全部就绪的 env_var 认证方法 */
  private selectAuthMethod(methods: AuthMethod[]): AuthMethod | null {
    for (const method of methods) {
      if (!('type' in method) || (method as { type?: string }).type !== 'env_var') continue;
      const vars = (method as { vars?: Array<{ name: string }> }).vars;
      if (!vars || vars.length === 0) continue;
      const allPresent = vars.every((v) => this.credentials?.[v.name]);
      if (allPresent) return method;
    }
    return null;
  }

  buildAuthRequiredData(authMethods?: AuthMethod[]): AuthRequiredData {
    return { agentBackend: this.agentBackend, methods: authMethods ?? [] };
  }
}

// ─── ApprovalCache（LRU，按序列化键存 optionId） ───────────────────

export class ApprovalCache {
  private cache = new Map<string, string>();

  constructor(public readonly maxSize: number = 500) {}

  get size(): number {
    return this.cache.size;
  }

  get(key: string): string | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, optionId: string): void {
    this.cache.delete(key);
    this.cache.set(key, optionId);
    if (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value!;
      this.cache.delete(oldest);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

/** 缓存键：kind + title + rawInput 中的操作标识字段（命令/路径） */
function buildCacheKey(request: RequestPermissionRequest): string {
  const { kind, title, rawInput } = request.toolCall;
  const normalizedInput: Record<string, unknown> = {};
  if (rawInput && typeof rawInput === 'object') {
    const input = rawInput as Record<string, unknown>;
    if (input.command) normalizedInput.command = input.command;
    if (input.path) normalizedInput.path = input.path;
    if (input.file_path) normalizedInput.file_path = input.file_path;
  }
  return JSON.stringify({ kind: kind ?? 'unknown', title: title ?? '', rawInput: normalizedInput });
}

// ─── PermissionResolver ────────────────────────────────────────────

type PendingPermission = {
  callId: string;
  resolve: (response: RequestPermissionResponse) => void;
  reject: (error: Error) => void;
  createdAt: number;
};

type PendingPermissionWithContext = PendingPermission & {
  cacheKey: string;
};

export type PermissionResolverConfig = {
  autoApproveAll: boolean;
  cacheMaxSize?: number;
};

export class PermissionResolver {
  private readonly yoloMode: boolean;
  private readonly cache: ApprovalCache;
  private readonly pending = new Map<string, PendingPermissionWithContext>();

  constructor(config: PermissionResolverConfig) {
    this.yoloMode = config.autoApproveAll;
    this.cache = new ApprovalCache(config.cacheMaxSize ?? 500);
  }

  get hasPending(): boolean {
    return this.pending.size > 0;
  }

  async evaluate(
    request: RequestPermissionRequest,
    uiCallback: (data: PermissionUIData) => void
  ): Promise<RequestPermissionResponse> {
    // 第一级：YOLO —— 自动批准一切（客户端兜底）
    if (this.yoloMode) {
      const allowOption = request.options.find((o) => o.kind.startsWith('allow_'));
      const optionId = allowOption?.optionId ?? request.options[0].optionId;
      return { outcome: { outcome: 'selected', optionId } };
    }

    // 第二级：缓存命中（会话级 "always allow" 记忆）
    const cacheKey = buildCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { outcome: { outcome: 'selected', optionId: cached } };
    }

    // 第三级：UI 委托
    const { toolCall } = request;
    const callId = toolCall.toolCallId;
    return new Promise<RequestPermissionResponse>((resolve, reject) => {
      this.pending.set(callId, { callId, resolve, reject, createdAt: Date.now(), cacheKey });
      uiCallback({
        callId,
        title: toolCall.title ?? '',
        description: '',
        kind: toolCall.kind ? mapToolKind(toolCall.kind) : undefined,
        options: request.options.map((o) => ({
          optionId: o.optionId,
          label: o.name,
          kind: o.kind,
        })),
        locations: toolCall.locations?.map((l) => ({
          path: l.path,
          range: l.line != null ? { startLine: l.line } : undefined,
        })),
        rawInput: toolCall.rawInput,
      });
    });
  }

  resolve(callId: string, optionId: string): void {
    const entry = this.pending.get(callId);
    if (!entry) return;
    this.pending.delete(callId);

    // 只缓存 "allow always" 决策供后续自动批准
    if (optionId.startsWith('allow_') && optionId.includes('always')) {
      this.cache.set(entry.cacheKey, optionId);
    }

    entry.resolve({ outcome: { outcome: 'selected', optionId } });
  }

  rejectAll(error: Error): void {
    for (const entry of this.pending.values()) {
      entry.reject(error);
    }
    this.pending.clear();
  }
}

// ─── 工具 kind 映射（SDK → Fouc 三分类） ──────────────────────────

const TOOL_KIND_MAP: Record<string, 'read' | 'edit' | 'execute'> = {
  read: 'read',
  search: 'read',
  edit: 'edit',
  delete: 'edit',
  move: 'edit',
  execute: 'execute',
  think: 'execute',
  fetch: 'execute',
  switch_mode: 'execute',
  other: 'execute',
};

export function mapToolKind(kind: string | null | undefined): 'read' | 'edit' | 'execute' {
  if (!kind) return 'execute';
  return TOOL_KIND_MAP[kind] ?? 'execute';
}
