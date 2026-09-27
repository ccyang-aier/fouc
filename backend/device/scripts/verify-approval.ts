/**
 * 审批链端到端验证：Fouc 后端 ↔ Mock ACP Agent（真实子进程/NDJSON/SDK）。
 *
 * 验证点：
 *  1. Mock Agent 发起 session/request_permission 后，PermissionResolver
 *     走 UI 委托路径（YOLO 关闭、缓存未命中）
 *  2. resolve(allow_once) 后 outcome 正确回写协议对端
 *  3. Agent 继续完成 turn，消息回显审批结果
 *  4. 二次 prompt 同类请求命中审批缓存（不再走 UI 委托）
 *
 * 运行：bun backend/device/scripts/verify-approval.ts
 * 退出码 0 = 全部通过。
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RequestPermissionRequest, SessionNotification } from '@agentclientprotocol/sdk';
import { ProcessAcpClient } from '../src/agents/driver/acp/client';
import { PermissionResolver } from '../src/agents/driver/acp/auth';
import { noopProtocolHandlers } from '../src/agents/driver/acp/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const mockAgent = path.join(here, 'mock-acp-agent.ts');

const uiEvents: Array<{ callId: string; title: string }> = [];
const resolver = new PermissionResolver({ autoApproveAll: false, cacheMaxSize: 100 });
let agentText = '';
/** 每轮模拟用户的选择（allow_once 不入缓存；allow_always 入缓存） */
let userChoice = 'allow_once';

const handlers = {
  ...noopProtocolHandlers,
  onSessionUpdate: (notification: SessionNotification) => {
    const update = notification.update as unknown as { sessionUpdate?: string; content?: { text?: string } };
    if (update?.sessionUpdate === 'agent_message_chunk') {
      agentText += update.content?.text ?? '';
    }
  },
  onRequestPermission: async (request: RequestPermissionRequest) => {
    return resolver.evaluate(request, (data) => {
      uiEvents.push({ callId: data.callId, title: data.title });
      // 模拟用户点击当前轮次的选择
      setTimeout(() => resolver.resolve(data.callId, userChoice), 100);
    });
  },
};

const client = new ProcessAcpClient(
  async () => {
    const { spawnAgentProcess } = await import('../src/execution/process');
    return spawnAgentProcess({
      command: process.execPath,
      args: [mockAgent],
      cwd: process.cwd(),
      env: {},
    });
  },
  { backend: 'mock-agent', handlers }
);

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`);
  }
}

async function turn(input: string): Promise<string> {
  agentText = '';
  await client.prompt(sessionIdGlobal, [{ type: 'text', text: input }]);
  return agentText;
}

let sessionIdGlobal = '';

async function main(): Promise<void> {
  console.log('[verify-approval] starting mock agent…');
  const init = await client.start();
  assert(init.agentInfo?.name === 'mock-agent', `initialize handshake (agent=${init.agentInfo?.name})`);

  const session = await client.createSession({ cwd: process.cwd() });
  sessionIdGlobal = session.sessionId ?? '';

  // —— 第一轮：应触发 UI 委托，用户批准后 Agent 收到 allow_once ——
  const turn1 = await turn('run echo');
  assert(uiEvents.length === 1, `permission went to UI delegation (${uiEvents.length} request)`);
  assert(uiEvents[0]?.title === 'bash: echo APPROVAL-TEST', 'UI payload carries tool title/kind/rawInput');
  assert(turn1.includes('APPROVAL-OUTCOME=allow_once'), `outcome round-tripped to agent (${turn1.trim()})`);

  // —— 第二轮：allow_once 不入缓存（1.x 语义：once 每次都问），应再次 UI 委托 ——
  const uiAfterOnce = uiEvents.length;
  const turn2 = await turn('run echo again');
  assert(uiEvents.length === uiAfterOnce + 1, 'allow_once is not cached — asks again (1.x semantics)');
  assert(turn2.includes('APPROVAL-OUTCOME=allow_once'), 'second once-round-trip ok');

  // —— 第三轮：allow_always 入缓存，同类请求不再打扰用户 ——
  userChoice = 'allow_always';
  await turn('run echo with always');
  const uiAfterAlways = uiEvents.length;
  const turn4 = await turn('run echo cached');
  assert(uiEvents.length === uiAfterAlways, 'identical request after allow_always hit cache (no UI prompt)');
  assert(turn4.includes('APPROVAL-OUTCOME=allow_always'), 'cached allow_always decision replayed');

  await client.close();
  console.log(failures === 0 ? '[verify-approval] ALL PASS' : `[verify-approval] ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('[verify-approval] fatal:', error);
  process.exit(1);
});
