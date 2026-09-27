/**
 * 目录声明 → 具体启动命令行。
 *
 * 桥的本地化解析（版本由 backend/device/package.json 锁定）：
 *  - 开发态：devEntry 存在于 backend/device/node_modules → js 经 bun 运行、native 直接执行
 *  - 打包态：backend-dispatch 桥以 `fouc-backend --bridge <provider>` 分发（适配器
 *    编译进后端二进制）；npm-download 桥（如 codex 的 80MB 原生二进制）首次使用
 *    时下载到 userData 并缓存
 *
 * Per-Agent 启动策略（移植 AionCore acp_launch_policy.rs，实测契约）：
 *  - claude 桥经 CLAUDE_CODE_EXECUTABLE 驱动用户自装的原生 claude 可执行
 *    （适配器 0.39+ 的官方通道，免内嵌 CLI 与运行时垫片）
 *  - codex 桥追加 -c 运行时配置：shell 环境全量继承 + sandbox 档位
 *    （YOLO → danger-full-access，Windows 追加 unelevated 沙箱）
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import type { ProviderSpec, AgentInstallation } from '@fouc/shared';
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
  gemini: ['gemini'],
  opencode: ['opencode'],
  qwen: ['qwen', 'qwen code'],
  codebuddy: ['codebuddy'],
  goose: ['goose'],
  auggie: ['auggie', 'augment'],
  kimi: ['kimi'],
  droid: ['droid', 'factory'],
  copilot: ['copilot', 'github copilot'],
  cursor: ['cursor'],
  kiro: ['kiro'],
  qoder: ['qoder'],
  vibe: ['vibe', 'mistral'],
  hermes: ['hermes'],
  snow: ['snow'],
  amp: ['amp'],
  'cortex-code': ['cortex'],
  'corust-agent': ['corust'],
  devin: ['devin'],
  harn: ['harn'],
  junie: ['junie'],
  poolside: ['pool', 'poolside'],
  stakpak: ['stakpak'],
  vtcode: ['vt'],
  antigravity: ['antigravity', 'agy'],
  omp: ['omp', 'pi'],
  'mimo-code': ['mimo'],
  kilo: ['kilo'],
  nova: ['nova'],
  dirac: ['dirac'],
  grok: ['grok'],
};

export async function buildLaunchSpec(
  provider: ProviderSpec,
  installation: AgentInstallation,
  cwd: string,
  options?: { yoloMode?: boolean }
): Promise<AcpLaunchSpec> {
  if (provider.acpLaunch.kind === 'native') {
    return {
      command: installation.executablePath,
      args: [...provider.acpLaunch.args],
      cwd,
      env: provider.acpLaunch.env,
    };
  }

  const { devRuntime, devEntry, packaged } = provider.acpLaunch;
  if (!IS_PACKAGED) {
    let devPath: string;
    try {
      devPath = createRequire(import.meta.url).resolve(devEntry);
    } catch {
      throw new Error(`bridge artifact missing in dev: ${devEntry}`);
    }
    if (devRuntime === 'native') return { command: devPath, args: [], cwd };
    return { command: 'bun', args: ['run', devPath], cwd, env: claudeBridgeEnv(provider, installation) };
  }

  if (packaged.source === 'backend-dispatch') {
    return {
      command: process.execPath,
      args: ['--bridge', provider.id],
      cwd,
      env: claudeBridgeEnv(provider, installation),
    };
  }
  const spec: AcpLaunchSpec = { command: await ensureNpmBridge(packaged), args: [], cwd };
  if (provider.id === 'codex') applyCodexRuntimeConfig(spec, options?.yoloMode ?? false);
  log.debug(`[${provider.id}] launch: ${spec.command} ${(spec.args ?? []).join(' ')}`);
  return spec;
}

/** claude 桥（0.39+）：指向用户自装的原生 claude 可执行（探测解析出的安装路径） */
function claudeBridgeEnv(provider: ProviderSpec, installation: AgentInstallation): Record<string, string> | undefined {
  if (provider.id !== 'claude-code') return undefined;
  return { CLAUDE_CODE_EXECUTABLE: installation.executablePath };
}

/**
 * codex 桥运行时配置（AionCore acp_launch_policy 实测契约）：
 * shell 工具继承完整环境；sandbox 档位随 YOLO 请求切换。
 */
function applyCodexRuntimeConfig(spec: AcpLaunchSpec, yolo: boolean): void {
  const config: string[] = [
    'shell_environment_policy.inherit=all',
    'shell_environment_policy.include_only=[]',
    `sandbox_mode="${yolo ? 'danger-full-access' : 'workspace-write'}"`,
  ];
  if (yolo && process.platform === 'win32') {
    config.push('windows.sandbox="unelevated"');
  }
  for (const entry of config) {
    spec.args.push('-c', entry);
  }
}

/** 校验 initialize 响应中的 agentInfo 是否匹配 Provider 期望身份 */
export function matchesExpectedIdentity(providerId: string, agentName: string | null | undefined): boolean {
  if (!agentName) return true; // Agent 未自报身份时不否定（部分桥不透传）
  const expected = EXPECTED_AGENT_IDENTITY[providerId];
  if (!expected) return true;
  const lower = agentName.toLowerCase();
  return expected.some((needle) => lower.includes(needle));
}
