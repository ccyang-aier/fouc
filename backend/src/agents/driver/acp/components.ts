/**
 * @license
 * 会话子组件移植自 AionUi (aionui.com) 的 src/process/acp/session/
 * （ConfigTracker.ts / PromptTimer.ts / InputPreprocessor.ts / McpConfig.ts，
 * Apache-2.0），Copyright 2025 AionUi (aionui.com)，
 * 按 Apache-2.0 授权复用并修改。
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ContentBlock } from '@agentclientprotocol/sdk';
import type { ConfigOptionDto } from '@shared/index';
import type { PromptContent } from './types';

// ─── PromptTimer（可暂停的 prompt 超时计时器） ─────────────────────

export type TimerState = 'idle' | 'running' | 'paused';

export class PromptTimer {
  private _state: TimerState = 'idle';
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private remaining: number;
  private startedAt = 0;

  constructor(
    private readonly timeoutMs: number,
    private readonly onTimeout: () => void
  ) {
    this.remaining = timeoutMs;
  }

  get state(): TimerState {
    return this._state;
  }

  start(): void {
    this.clearTimer();
    this.remaining = this.timeoutMs;
    this.startedAt = Date.now();
    this.timerId = setTimeout(() => this.fire(), this.remaining);
    this._state = 'running';
  }

  reset(): void {
    if (this._state !== 'running') return;
    this.clearTimer();
    this.remaining = this.timeoutMs;
    this.startedAt = Date.now();
    this.timerId = setTimeout(() => this.fire(), this.remaining);
  }

  pause(): void {
    if (this._state !== 'running') return;
    this.clearTimer();
    this.remaining -= Date.now() - this.startedAt;
    if (this.remaining < 0) this.remaining = 0;
    this._state = 'paused';
  }

  resume(): void {
    if (this._state !== 'paused') return;
    this.startedAt = Date.now();
    this.timerId = setTimeout(() => this.fire(), this.remaining);
    this._state = 'running';
  }

  stop(): void {
    this.clearTimer();
    this.remaining = this.timeoutMs;
    this._state = 'idle';
  }

  private fire(): void {
    this._state = 'idle';
    this.timerId = null;
    this.onTimeout();
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}

// ─── ConfigTracker（当前/期望配置双轨追踪） ────────────────────────

type SyncResult = {
  currentModelId?: string | null;
  availableModels?: Array<{ modelId?: string; id?: string; name?: string; description?: string }>;
  currentModeId?: string | null;
  availableModes?: Array<{ id: string; name?: string; description?: string }>;
  configOptions?: ConfigOptionDto[];
};

type PendingChanges = {
  model: string | null;
  mode: string | null;
  configOptions: Array<{ id: string; value: string | boolean }>;
};

export class ConfigTracker {
  private availableModels: Array<{ id: string; name: string; description?: string }> = [];
  private availableModes: Array<{ id: string; name: string; description?: string }> = [];

  private currentModelId: string | null = null;
  private currentModeId: string | null = null;
  private currentConfigOptions: ConfigOptionDto[] = [];
  // 期望（用户意图，尚未同步）
  private desiredModelId: string | null = null;
  private desiredModeId: string | null = null;
  private desiredConfigOptions = new Map<string, string | boolean>();

  setDesiredModel(modelId: string): void {
    this.desiredModelId = modelId;
  }

  setCurrentModel(modelId: string): void {
    this.currentModelId = modelId;
    if (this.desiredModelId === modelId) this.desiredModelId = null;
  }

  setDesiredMode(modeId: string): void {
    this.desiredModeId = modeId;
  }

  setCurrentMode(modeId: string): void {
    this.currentModeId = modeId;
    if (this.desiredModeId === modeId) this.desiredModeId = null;
  }

  setDesiredConfigOption(id: string, value: string | boolean): void {
    this.desiredConfigOptions.set(id, value);
  }

  setCurrentConfigOption(id: string, value: string | boolean): void {
    const opt = this.currentConfigOptions.find((o) => o.id === id);
    if (opt) opt.currentValue = value;
    this.desiredConfigOptions.delete(id);
  }

  syncFromSessionResult(result: SyncResult): void {
    if (result.currentModelId !== undefined) this.currentModelId = result.currentModelId;
    if (result.availableModels) {
      this.availableModels = result.availableModels.map((m) => ({
        id: (m as { modelId?: string }).modelId ?? m.id ?? '',
        name: m.name ?? (m as { modelId?: string }).modelId ?? m.id ?? '',
        description: m.description,
      }));
    }
    if (result.currentModeId !== undefined) this.currentModeId = result.currentModeId;
    if (result.availableModes) {
      this.availableModes = result.availableModes.map((m) => ({ id: m.id, name: m.name ?? m.id, description: m.description }));
    }
    if (result.configOptions) this.currentConfigOptions = result.configOptions;
  }

  /** 从 initialize 响应预置模式（qwen-code 只在 initialize 时宣告可用模式） */
  syncFromInitializeResult(
    modes: { currentModeId?: string | null; availableModes?: Array<{ id: string; name?: string; description?: string }> } | null
  ): void {
    if (!modes) return;
    if (modes.currentModeId !== undefined) this.currentModeId = modes.currentModeId;
    if (modes.availableModes && modes.availableModes.length > 0) {
      this.availableModes = modes.availableModes.map((m) => ({ id: m.id, name: m.name ?? m.id, description: m.description }));
    }
  }

  getPendingChanges(): PendingChanges {
    return {
      model: this.desiredModelId,
      mode: this.desiredModeId,
      configOptions: Array.from(this.desiredConfigOptions.entries()).map(([id, value]) => ({ id, value })),
    };
  }

  modelSnapshot() {
    return { currentModelId: this.currentModelId, availableModels: [...this.availableModels] };
  }

  modeSnapshot() {
    return { currentModeId: this.currentModeId, availableModes: [...this.availableModes] };
  }

  configSnapshot(): ConfigOptionDto[] {
    return this.currentConfigOptions.map((o) => ({ ...o }));
  }
}

// ─── InputPreprocessor（@文件引用与附件展开） ─────────────────────

const AT_FILE_REGEX = /@(?:"([^"]+)"|(\S+\.\w+))/g;
const BINARY_EXTENSIONS = new Set([
  '.7z', '.avi', '.avif', '.bmp', '.class', '.doc', '.docm', '.docx', '.exe', '.gif', '.gz',
  '.heic', '.heif', '.ico', '.jar', '.jpeg', '.jpg', '.m4a', '.mov', '.mp3', '.mp4', '.ogg',
  '.pdf', '.png', '.ppt', '.pptm', '.pptx', '.rar', '.svg', '.tar', '.tif', '.tiff', '.wav',
  '.webm', '.webp', '.xls', '.xlsb', '.xlsm', '.xlsx', '.zip',
]);
const MIME_BY_EXTENSION: Record<string, string> = {
  '.bmp': 'image/bmp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export class InputPreprocessor {
  constructor(private readonly readFile: (path: string) => string) {}

  process(text: string, files?: string[]): PromptContent {
    const items: ContentBlock[] = [{ type: 'text', text }];
    const readPaths = new Set<string>();

    // 1. 先读取显式附件
    if (files) {
      for (const filePath of files) {
        if (readPaths.has(filePath)) continue;
        const item = this.tryReadFile(filePath);
        if (item) {
          items.push(item);
          readPaths.add(filePath);
        }
      }
    }

    // 2. 解析文本中的 @引用（跳过已读文件）
    for (const match of text.matchAll(AT_FILE_REGEX)) {
      const filePath = match[1] ?? match[2];
      if (!filePath || readPaths.has(filePath)) continue;

      const basename = filePath.split(/[\\/]/).pop();
      if (files?.some((f) => f === filePath || f.endsWith(`/${basename}`) || f.endsWith(`\\${basename}`))) {
        continue;
      }

      const item = this.tryReadFile(filePath);
      if (item) {
        items.push(item);
        readPaths.add(filePath);
      }
    }
    return items;
  }

  private tryReadFile(filePath: string): ContentBlock | null {
    if (BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      return this.buildResourceLink(filePath);
    }
    try {
      const content = this.readFile(filePath);
      if (this.isLikelyBinaryContent(content)) {
        return this.buildResourceLink(filePath);
      }
      return { type: 'text', text: `[File: ${filePath}]\n${content}` };
    } catch {
      // 二进制或缺失文件 —— 静默跳过
      return null;
    }
  }

  private isLikelyBinaryContent(content: string): boolean {
    if (!content) return false;
    if (content.includes('\u0000') || content.includes('\uFFFD')) return true;
    const suspicious = this.countSuspiciousControlChars(content);
    if (suspicious >= 3) return true;
    return suspicious > 0 && suspicious / content.length > 0.01;
  }

  private countSuspiciousControlChars(content: string): number {
    let count = 0;
    for (const char of content) {
      const cp = char.codePointAt(0);
      if (cp === undefined) continue;
      if (
        (cp >= 0x00 && cp <= 0x08) ||
        cp === 0x0b ||
        cp === 0x0c ||
        (cp >= 0x0e && cp <= 0x1a) ||
        (cp >= 0x1c && cp <= 0x1f)
      ) {
        count += 1;
      }
    }
    return count;
  }

  private buildResourceLink(filePath: string): ContentBlock {
    const extension = path.extname(filePath).toLowerCase();
    const resourceLink = {
      type: 'resource_link' as const,
      name: path.basename(filePath) || filePath,
      uri: this.toResourceUri(filePath),
      ...(MIME_BY_EXTENSION[extension] ? { mimeType: MIME_BY_EXTENSION[extension] } : {}),
    };
    return resourceLink;
  }

  private toResourceUri(filePath: string): string {
    try {
      return pathToFileURL(path.resolve(filePath)).toString();
    } catch {
      return filePath;
    }
  }
}

// ─── MCP 配置合并 ──────────────────────────────────────────────────

type McpServerSpec = { name: string; command?: string; args?: string[]; env?: Array<{ name: string; value: string }> };

export const McpConfig = {
  /** preset < user，同名后者覆盖 */
  merge(params: { userServers?: McpServerSpec[]; presetServers?: McpServerSpec[] }): McpServerSpec[] {
    const merged = new Map<string, McpServerSpec>();
    for (const s of params.presetServers ?? []) merged.set(s.name, s);
    for (const s of params.userServers ?? []) merged.set(s.name, s);
    return Array.from(merged.values());
  },
};
