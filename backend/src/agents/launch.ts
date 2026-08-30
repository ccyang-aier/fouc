/**
 * 目录声明 → 具体启动命令行。
 *
 * 桥的本地化解析（版本由 backend/package.json 锁定）：
 *  - 开发态：devEntry 存在于 backend/node_modules → js 经 bun 运行、native 直接执行
 *  - 打包态：backend-dispatch 桥以 `fouc-backend --bridge <provider>` 分发（适配器
 *    编译进后端二进制）；npm-download 桥（如 codex 的 79MB 原生二进制）首次使用
 *    时下载到 userData 并缓存
 * 原生 ACP 的 Agent 直接以探测解析出的可执行路径 + 子命令启动。
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ProviderSpec, AgentInstallation } from '@shared/index';
import type { AcpLaunchSpec } from './driver/acp/client';
import { ensureNpmBridge } from './bridge-fetch';
import { createLogger } from '../platform/logger';

const log = createLogger('launch');

/**
 * 打包态判定：编译后的后端 exe 名为 fouc-backend*；开发态 execPath 是 bun 本体。
 * 不可用 import.meta.dir/源码邻接 node_modules 判定——编译 exe 在构建机上
 * 仍会解析出构建期的真实源码路径，导致打包态被误判为开发态。
 */
const IS_PACKAGED = /fouc-backend/i.test(path.basename(process.execPath));

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

export async function buildLaunchSpec(
  provider: ProviderSpec,
  installation: AgentInstallation,
  cwd: string
): Promise<AcpLaunchSpec> {
  if (provider.acpLaunch.kind === 'native') {
    return { command: installation.executablePath, args: [...provider.acpLaunch.args], cwd };
  }

  const { devRuntime, devEntry, packaged } = provider.acpLaunch;
  if (!IS_PACKAGED) {
    const devPath = path.join(import.meta.dir, '..', '..', 'node_modules', devEntry);
    if (!existsSync(devPath)) throw new Error(`bridge artifact missing in dev: ${devEntry}`);
    if (devRuntime === 'native') return { command: devPath, args: [], cwd };
    return { command: 'bun', args: ['run', devPath], cwd };
  }

  const spec =
    packaged.source === 'backend-dispatch'
      ? { command: process.execPath, args: ['--bridge', provider.id], cwd }
      : { command: await ensureNpmBridge(packaged), args: [], cwd };
  log.debug(`[${provider.id}] launch: ${spec.command} ${(spec.args ?? []).join(' ')}`);
  return spec;
}

/** 校验 initialize 响应中的 agentInfo 是否匹配 Provider 期望身份 */
export function matchesExpectedIdentity(providerId: string, agentName: string | null | undefined): boolean {
  if (!agentName) return true; // Agent 未自报身份时不否定（部分桥不透传）
  const expected = EXPECTED_AGENT_IDENTITY[providerId];
  if (!expected) return true;
  const lower = agentName.toLowerCase();
  return expected.some((needle) => lower.includes(needle));
}
