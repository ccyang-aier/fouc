/**
 * @license
 * 事件翻译移植自 AionUi (aionui.com) 的
 * src/process/acp/session/MessageTranslator.ts（Apache-2.0），
 * Copyright 2025 AionUi (aionui.com)，按 Apache-2.0 授权复用并修改。
 * 输出端由 AionUi 的聊天 TMessage 换为 Fouc 标准事件流（shared AgentEvent）。
 */

import type {
  AvailableCommandsUpdate,
  ContentChunk,
  Plan,
  SessionNotification,
  ToolCall,
  ToolCallUpdate,
} from '@agentclientprotocol/sdk';
import type { AgentEvent, ToolContentDto, ToolKindDto } from '@fouc/shared';
import { mapToolKind } from './auth';

const CONFIG_UPDATES = new Set<string>([
  'current_mode_update',
  'config_option_update',
  'session_info_update',
  'usage_update',
]);

function mapToolContent(
  content: Array<Record<string, unknown>> | null | undefined
): ToolContentDto[] | undefined {
  if (!content || content.length === 0) return undefined;
  return content.map((item): ToolContentDto => {
    if (item.type === 'diff') {
      const diff = item as unknown as { type: 'diff'; path?: string; oldText?: string; newText?: string };
      return { type: 'diff', path: diff.path, oldText: diff.oldText, newText: diff.newText };
    }
    const contentItem = item as unknown as { content?: { type?: string; text?: string } };
    return { type: 'content', text: contentItem.content?.text ?? '' };
  });
}

function mapToolLocations(locations: Array<{ path?: string }> | null | undefined): Array<{ path: string }> | undefined {
  if (!locations || locations.length === 0) return undefined;
  return locations.map((loc) => ({ path: loc.path ?? '' }));
}

/**
 * 无状态翻译器：SDK SessionNotification → Fouc AgentEvent。
 * 仅维护 messageMap 为每个 turn 分配稳定 msgId（turn 内 chunk 合并、
 * 跨 turn 不合并）。
 */
export class EventTranslator {
  private messageMap = new Map<string, string>();

  constructor(private readonly sessionId: string) {}

  translate(notification: SessionNotification): AgentEvent[] {
    const update = notification.update as unknown as Record<string, unknown> & { sessionUpdate: string };
    const updateType = update.sessionUpdate;

    if (CONFIG_UPDATES.has(updateType)) return [];

    switch (updateType) {
      case 'agent_message_chunk':
        return this.handleAgentMessageChunk(update as unknown as ContentChunk);
      case 'agent_thought_chunk':
        return this.handleThoughtChunk(update as unknown as ContentChunk);
      case 'tool_call':
        return this.handleToolCall(update as unknown as ToolCall);
      case 'tool_call_update':
        return this.handleToolCallUpdate(update as unknown as ToolCallUpdate);
      case 'plan':
        return this.handlePlan(update as unknown as Plan);
      case 'available_commands_update':
        return this.handleAvailableCommands(update as unknown as AvailableCommandsUpdate);
      case 'user_message_chunk':
        return [];
      default:
        return [];
    }
  }

  onTurnEnd(): void {
    this.messageMap.clear();
  }

  reset(): void {
    this.messageMap.clear();
  }

  /** 当前 turn 内为 SDK messageId 解析/创建稳定 UUID */
  private resolveMsgId(sdkMessageId: string): string {
    let msgId = this.messageMap.get(sdkMessageId);
    if (!msgId) {
      msgId = crypto.randomUUID();
      this.messageMap.set(sdkMessageId, msgId);
    }
    return msgId;
  }

  private handleAgentMessageChunk(update: ContentChunk): AgentEvent[] {
    const messageId = update.messageId ?? 'default';
    const content = update.content as { type?: string; text?: string };
    const text = content?.type === 'text' ? (content.text ?? '') : '';
    if (!text) return [];
    return [
      { type: 'message.delta', sessionId: this.sessionId, runId: null, role: 'agent', msgId: this.resolveMsgId(messageId), text },
    ];
  }

  private handleThoughtChunk(update: ContentChunk): AgentEvent[] {
    const messageId = `thought-${update.messageId ?? 'default'}`;
    const content = update.content as { type?: string; text?: string };
    const text = content?.type === 'text' ? (content.text ?? '') : '';
    if (!text) return [];
    return [
      { type: 'thought.delta', sessionId: this.sessionId, runId: null, msgId: this.resolveMsgId(messageId), text },
    ];
  }

  private handleToolCall(update: ToolCall): AgentEvent[] {
    // 工具调用打断当前文本流 —— 清空文本 msgId 映射，
    // 后续文本 chunk 开启新消息（保持与 AionUi 一致的行为）
    this.messageMap.clear();

    const toolCallId = update.toolCallId ?? crypto.randomUUID();
    const raw = update as unknown as Record<string, unknown>;
    return [
      {
        type: 'tool.started',
        sessionId: this.sessionId,
        runId: null,
        toolCallId,
        title: update.title ?? 'unknown',
        kind: mapToolKind(update.kind as string | null),
        rawInput: raw.rawInput,
        locations: mapToolLocations(raw.locations as Array<{ path?: string }> | undefined),
      },
    ];
  }

  private handleToolCallUpdate(update: ToolCallUpdate): AgentEvent[] {
    const toolCallId = update.toolCallId ?? '';
    const raw = update as unknown as Record<string, unknown>;
    const status = (update.status ?? 'completed') as 'in_progress' | 'completed' | 'failed';
    return [
      {
        type: 'tool.updated',
        sessionId: this.sessionId,
        runId: null,
        toolCallId,
        title: update.title ?? 'unknown',
        kind: mapToolKind(update.kind as string | null),
        status,
        content: mapToolContent(raw.content as Array<Record<string, unknown>> | undefined),
        rawOutput: raw.rawOutput ?? raw.raw_output,
      },
    ];
  }

  private handlePlan(plan: Plan): AgentEvent[] {
    // 计划是独立 UI 块 —— 清空文本映射，避免计划前后文本跨块合并
    this.messageMap.clear();
    if (!plan.entries || plan.entries.length === 0) return [];
    return [
      {
        type: 'plan.updated',
        sessionId: this.sessionId,
        runId: null,
        entries: plan.entries.map((e) => ({
          content: e.content,
          status: e.status as 'pending' | 'in_progress' | 'completed',
          priority: e.priority as 'low' | 'medium' | 'high' | undefined,
        })),
      },
    ];
  }

  private handleAvailableCommands(update: AvailableCommandsUpdate): AgentEvent[] {
    // 由会话层的 ConfigTracker 消费，不产生事件
    void update;
    return [];
  }
}

export { mapToolContent, mapToolLocations };
export type { ToolKindDto };
