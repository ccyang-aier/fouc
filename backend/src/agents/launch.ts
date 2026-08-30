/**
 * 目录声明 → 具体启动命令行。
 *
 * 桥接包统一经后端自身的 Bun 二进制以 `bun x --bun <pkg>@<version>` 启动
 * （AionCore 生产验证的形态）：桥运行时即后端自身，用户机器无需安装 Node。
 * 原生 ACP 的 Agent 直接以探测解析出的可执行路径 + 子命令启动。
 */

import type { ProviderSpec, AgentInstallation } from '@shared/index';
import type { AcpLaunchSpec } from './driver/acp/client';
import { createLogger } from '../platform/logger';

const log = createLogger('launch');

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
    // Windows 上 shim（.cmd/.bat）需要 shell；路径可直接执行
    const command = process.platform === 'win32' && /\.(cmd|bat)$/i.test(installation.executablePath)
      ? installation.executablePath
      : installation.executablePath;
    return { command, args: [...provider.acpLaunch.args], cwd };
  }

  const pkg = `${provider.acpLaunch.pkg}@${provider.acpLaunch.version}`;
  if (provider.acpLaunch.bridgeBinary === 'bun') {
    // 后端自身即 Bun：以 process.execPath 启动桥，免运行时依赖
    return { command: process.execPath, args: ['x', '--bun', pkg], cwd };
  }
  // npx 回退（理论上不会走到：目录当前全部声明为 bun 桥）
  log.warn(`Provider ${provider.id} declares npx bridge — falling back to system npx`);
  return { command: 'npx', args: ['-y', pkg], cwd };
}

/** 校验 initialize 响应中的 agentInfo 是否匹配 Provider 期望身份 */
export function matchesExpectedIdentity(providerId: string, agentName: string | null | undefined): boolean {
  if (!agentName) return true; // Agent 未自报身份时不否定（部分桥不透传）
  const expected = EXPECTED_AGENT_IDENTITY[providerId];
  if (!expected) return true;
  const lower = agentName.toLowerCase();
  return expected.some((needle) => lower.includes(needle));
}
