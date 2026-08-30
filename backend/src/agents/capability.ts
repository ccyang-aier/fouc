/**
 * CapabilityManifest 生成：ACP 握手响应 → 能力清单 + L0–L3 层级判定。
 * 能力只能来自探测握手，禁止静态假设（Fouc F0 红线）。
 */

import type { CapabilityManifest, AdapterLevel } from '@shared/index';
import { createHash } from 'node:crypto';

export type HandshakeEvidence = {
  protocolVersion: number;
  agentName: string | null;
  agentVersion: string | null;
  loadSession: boolean;
  promptCapabilities: { image: boolean; audio: boolean; embeddedContext: boolean };
  mcpCapabilities: { stdio: boolean; http: boolean; sse: boolean };
  sessionCapabilities: { fork: boolean; resume: boolean; list: boolean; close: boolean };
  authMethods: Array<{ id: string; name: string }>;
  models: Array<{ id: string; name: string; description?: string }>;
  modes: Array<{ id: string; name: string; description?: string }>;
  configOptions: CapabilityManifest['controls']['configOptions'];
};

/** Fouc 兼容的 ACP 协议版本范围（下限） */
export const MIN_PROTOCOL_VERSION = 1;

export function buildCapabilityManifest(
  evidence: HandshakeEvidence,
  skillsDir: string | null,
  authRequiredByCatalog: boolean
): CapabilityManifest {
  const manifest: CapabilityManifest = {
    adapterLevel: 'L0',
    protocol: { kind: 'acp', version: evidence.protocolVersion },
    agentName: evidence.agentName,
    version: evidence.agentVersion,
    session: {
      resume: evidence.loadSession,
      fork: evidence.sessionCapabilities.fork,
      list: evidence.sessionCapabilities.list,
      close: evidence.sessionCapabilities.close,
    },
    input: evidence.promptCapabilities,
    controls: {
      models: evidence.models,
      modes: evidence.modes,
      configOptions: evidence.configOptions,
    },
    extensions: { mcp: evidence.mcpCapabilities, skillsDir },
    events: deriveSupportedEvents(evidence),
    auth: {
      methods: evidence.authMethods,
      needsAuth: authRequiredByCatalog || evidence.authMethods.length > 0,
    },
    probedAt: Date.now(),
    fingerprint: '',
  };
  manifest.adapterLevel = deriveAdapterLevel(manifest);
  manifest.fingerprint = fingerprintManifest(manifest);
  return manifest;
}

/**
 * L 层判定：
 *  L1 = initialize 握手成功；L2 = L1 + session/load；
 *  L3 = L2 + 工具事件 + 权限审批 + 用量（ACP 协议保证，探测即得）。
 */
function deriveAdapterLevel(manifest: CapabilityManifest): AdapterLevel {
  if (!manifest.protocol.version) return 'L0';
  if (!manifest.session.resume) return 'L1';
  // ACP 的 tool_call / request_permission / usage_update 是协议内建能力，
  // 能完成握手即视为具备 L3 结构化控制面
  return 'L3';
}

function deriveSupportedEvents(evidence: HandshakeEvidence): string[] {
  const events = [
    'session.started',
    'session.status',
    'session.ended',
    'run.started',
    'run.completed',
    'run.failed',
    'run.cancelled',
    'message.delta',
    'thought.delta',
    'tool.started',
    'tool.updated',
    'plan.updated',
    'control.updated',
    'approval.required',
  ];
  if (evidence.loadSession) events.push('session.resume');
  return events;
}

function fingerprintManifest(manifest: CapabilityManifest): string {
  const material = JSON.stringify({
    v: manifest.protocol.version,
    agent: manifest.agentName,
    ver: manifest.version,
    s: manifest.session,
    m: manifest.extensions.mcp,
  });
  return createHash('sha256').update(material).digest('hex').substring(0, 16);
}
