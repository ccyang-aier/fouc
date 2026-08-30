/**
 * 受控 ACP Mock Agent：以真实子进程形态跑 NDJSON JSON-RPC，
 * 在收到 session/prompt 时先发 session/request_permission（服务端→客户端请求），
 * 收到审批结果后将其回显进 agent 消息，用于验证 Fouc 的审批往返链路。
 *
 * 帧格式与 @agentclientprotocol/sdk 的线协议一致。
 */

import { createInterface } from 'node:readline';

let nextId = 100;

function send(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function reply(id: unknown, result: unknown): void {
  send({ jsonrpc: '2.0', id, result });
}

const stdin = createInterface({ input: process.stdin });

stdin.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg: { id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }

  switch (msg.method) {
    case 'initialize':
      reply(msg.id, {
        protocolVersion: 1,
        agentInfo: { name: 'mock-agent', version: '1.0.0' },
        authMethods: [],
        capabilities: {
          loadSession: true,
          promptCapabilities: { image: false, audio: false, embeddedContext: false },
          mcpCapabilities: { stdio: true, http: false, sse: false },
          sessionCapabilities: { fork: {}, resume: {}, list: {}, close: {} },
        },
      });
      break;

    case 'session/new':
      reply(msg.id, {
        sessionId: 'mock-session-1',
        models: { currentModelId: 'mock-model', availableModels: [{ modelId: 'mock-model', name: 'Mock Model' }] },
        modes: { currentModeId: 'default', availableModes: [{ id: 'default', name: 'Default' }] },
      });
      break;

    case 'session/prompt': {
      const permId = `perm-${nextId++}`;
      // 服务端 → 客户端审批请求
      send({
        jsonrpc: '2.0',
        id: permId,
        method: 'session/request_permission',
        params: {
          sessionId: (msg.params as { sessionId: string })?.sessionId,
          options: [
            { optionId: 'allow_once', name: 'Allow', kind: 'allow_once' },
            { optionId: 'reject_once', name: 'Deny', kind: 'reject_once' },
          ],
          toolCall: {
            toolCallId: 'tc-1',
            title: 'bash: echo APPROVAL-TEST',
            kind: 'execute',
            rawInput: { command: 'echo APPROVAL-TEST' },
          },
        },
      });

      // 等审批响应（同 id 的 result），然后回显并完成 turn
      const waitForOutcome = (raw: string): void => {
        try {
          const response = JSON.parse(raw) as { id?: unknown; result?: { outcome?: { optionId?: string } } };
          if (response.id !== permId) {
            stdin.once('line', waitForOutcome);
            return;
          }
          const outcome = response.result?.outcome?.optionId ?? 'unknown';
          send({
            jsonrpc: '2.0',
            method: 'session/update',
            params: {
              sessionId: (msg.params as { sessionId: string })?.sessionId,
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: { type: 'text', text: `APPROVAL-OUTCOME=${outcome}` },
              },
            },
          });
          reply(msg.id, { stopReason: 'end_turn' });
        } catch {
          stdin.once('line', waitForOutcome);
        }
      };
      stdin.once('line', waitForOutcome);
      break;
    }

    case 'session/set_mode':
    case 'session/set_config_option':
      reply(msg.id, {});
      break;

    default:
      if (msg.id !== undefined) {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } });
      }
      break;
  }
});
