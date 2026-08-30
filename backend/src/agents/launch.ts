/**
 * 目录声明 → 具体启动命令行。
 *
 * 桥接工件本地化：开发态直接运行 backend/node_modules 下的入口（js 入口经
 * bun 运行，native 直接执行）；打包态运行随应用分发的桥 sidecar（Rust 壳经
 * FOUC_BRIDGE_DIR 指向后端 exe 同目录）。原生 ACP 的 Agent 直接以探测解析
 * 出的可执行路径 + 子命令启动。
 */

import path from 'node:path';
import type { ProviderSpec, AgentInstallation } from '@shared/index';
import type { AcpLaunchSpec } from './driver/acp/client';

/** 每个 Provider 期望的 Agent 身份标识（initialize 响应 agentInfo.name 匹配用） */
export const EXPECTED_AGENT_IDENTITY: Record<string, string[]> = {
  'claude-code': ['claude', 'claude code'],
  codex: ['codex'],
  opencode: ['opencode'],
  qwen: ['qwen', 'qwen code'],
  goose: ['goose'],
  auggie: ['auggie', 'augment'],
  kimi: ['kimi'],
  droid: ['droid', 'factory'],
  copilot: ['copilot', 'github copilot'],
  cursor: ['cursor'],
  kiro: ['kiro'],
  codebuddy: ['codebuddy'],
  qoder: ['qoder'],
  vibe: ['vibe', 'mistral'],
  hermes: ['hermes'],
  snow: ['snow'],
};

export function buildLaunchSpec(provider: ProviderSpec, installation: AgentInstallation, cwd: string): AcpLaunchSpec {
  if (provider.acpLaunch.kind === 'native') {
    return { command: installation.executablePath, args: [...provider.acpLaunch.args], cwd };
  }

  const { bridgeRuntime, entry, binary } = provider.acpLaunch;
  const packagedDir = process.env.FOUC_BRIDGE_DIR?.trim();
  if (packagedDir) {
    // 打包态：随应用分发的桥 sidecar
    const ext = process.platform === 'win32' ? '.exe' : '';
    return { command: path.join(packagedDir, binary + ext), args: [], cwd };
  }
  // 开发态：直接运行 backend/node_modules 下的本地工件
  const entryPath = path.join(import.meta.dir, '..', '..', 'node_modules', entry);
  if (bridgeRuntime === 'native') {
    return { command: entryPath, args: [], cwd };
  }
  return { command: 'bun', args: ['run', entryPath], cwd };
}

/** 校验 initialize 响应中的 agentInfo 是否匹配 Provider 期望身份 */
export function matchesExpectedIdentity(providerId: string, agentName: string | null | undefined): boolean {
  if (!agentName) return true; // Agent 未自报身份时不否定（部分桥不透传）
  const expected = EXPECTED_AGENT_IDENTITY[providerId];
  if (!expected) return true;
  const lower = agentName.toLowerCase();
  return expected.some((needle) => lower.includes(needle));
}
