/**
 * @license
 * 发现算法移植自 AionUi (aionui.com) 的
 * src/process/agent/acp/AcpDetector.ts（Apache-2.0），
 * Copyright 2025 AionUi (aionui.com)，按 Apache-2.0 授权复用并修改。
 *
 * 纯检测模块：不持有状态、不做身份确认（probe 负责）、不编排（registry 负责）。
 * Fouc 收紧点：PATH 命中只产生候选（unchecked），必须经 probe 确认身份。
 */

import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLogger } from '../platform/logger';
import { getEnhancedEnv, mergePaths } from '../platform/env';
import { runCleanCli } from '../execution/process';
import type { ProviderSpec } from '@fouc/shared';

const log = createLogger('discovery');

export interface DiscoveredCandidate {
  providerId: string;
  cliCommand: string;
  executablePath: string;
  source: 'path' | 'known_location';
}

class AgentDetector {
  /** 批量检查命令在 PATH 上的可用性（POSIX 单 shell / Windows where + PowerShell 双回退） */
  async batchCheckCliAvailability(commands: string[]): Promise<Set<string>> {
    if (commands.length === 0) return new Set();

    // 拒绝含 shell 元字符的命令，防注入
    const safe = commands.filter((cmd) => /^[a-zA-Z0-9_.-]+$/.test(cmd));
    if (safe.length === 0) return new Set();

    const env = getEnhancedEnv();
    const isWindows = process.platform === 'win32';

    if (!isWindows) {
      // 单次 shell 调用完成全部检测（shell 内建 command -v，避免逐命令起进程）
      const checks = safe.map((cmd) => `command -v '${cmd}' >/dev/null 2>&1 && echo '${cmd}'`);
      const script = checks.join('; ') + '; true';
      const result = await runCleanCli('/bin/sh', ['-c', script], { timeoutMs: 3000, env });
      return new Set(result.stdout.trim().split('\n').filter(Boolean));
    }

    // Windows：并行 where，失败回退 PowerShell Get-Command
    const results = await Promise.allSettled(
      safe.map(async (cmd): Promise<string | null> => {
        const where = await runCleanCli('where', [cmd], { timeoutMs: 3000, env });
        if (where.code === 0) return cmd;
        const ps = await runCleanCli(
          'powershell',
          ['-NoProfile', '-NonInteractive', '-Command', `Get-Command -All ${cmd} | Select-Object -First 1 | Out-Null`],
          { timeoutMs: 5000, env }
        );
        if (ps.code === 0) return cmd;
        return null;
      })
    );
    return new Set(
      results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value !== null).map(
        (r) => r.value
      )
    );
  }

  /** 解析命令在 PATH 上的首个命中位置（Windows 返回 where 首行） */
  async resolveCliPath(command: string): Promise<string | null> {
    if (!/^[a-zA-Z0-9_.-]+$/.test(command)) return null;
    const env = getEnhancedEnv();
    if (process.platform === 'win32') {
      const result = await runCleanCli('where', [command], { timeoutMs: 3000, env });
      const first = result.stdout.trim().split(/\r?\n/)[0]?.trim();
      if (result.code === 0 && first && existsSync(first)) return first;
      return null;
    }
    const result = await runCleanCli('/bin/sh', ['-c', `command -v '${command}'`], { timeoutMs: 3000, env });
    const first = result.stdout.trim();
    if (result.code === 0 && first && existsSync(first)) return first;
    return null;
  }

  /** 从 PATH 检测目录中的全部内置 Provider */
  async detectFromPath(providers: ProviderSpec[]): Promise<DiscoveredCandidate[]> {
    const available = await this.batchCheckCliAvailability(providers.map((p) => p.cliCommand));
    const missing = providers.filter((p) => !available.has(p.cliCommand));
    if (missing.length > 0) {
      const envPath = getEnhancedEnv().PATH ?? '';
      log.info(
        `CLI not found: [${missing.map((p) => p.cliCommand).join(', ')}]. PATH(${envPath.length} chars): ${envPath.substring(0, 300)}`
      );
    }

    const candidates: DiscoveredCandidate[] = [];
    for (const provider of providers) {
      if (!available.has(provider.cliCommand)) continue;
      const resolved = await this.resolveCliPath(provider.cliCommand);
      candidates.push({
        providerId: provider.id,
        cliCommand: provider.cliCommand,
        executablePath: resolved ?? provider.cliCommand,
        source: 'path',
      });
    }
    return candidates;
  }

  /**
   * 扫描常见安装位置中与目录命令同名的可执行文件。
   * 只对目录内同条目做 stat，不遍历无关用户文件。
   */
  scanKnownLocations(providers: ProviderSpec[]): DiscoveredCandidate[] {
    const dirs = knownToolDirs();
    const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
    const candidates: DiscoveredCandidate[] = [];

    for (const provider of providers) {
      for (const dir of dirs) {
        for (const ext of exts) {
          const candidate = path.join(dir, provider.cliCommand + ext);
          if (existsSync(candidate)) {
            candidates.push({
              providerId: provider.id,
              cliCommand: provider.cliCommand,
              executablePath: candidate,
              source: 'known_location',
            });
            break;
          }
        }
        // 找到该 provider 的一个位置即停止
        if (candidates.some((c) => c.providerId === provider.id)) break;
      }
    }
    return candidates;
  }
}

function knownToolDirs(): string[] {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    return [
      path.join(home, '.local', 'bin'),
      path.join(appData, 'npm'),
      path.join(localAppData, 'Programs'),
      path.join(process.env.SCOOP || path.join(home, 'scoop'), 'shims'),
      path.join(home, '.bun', 'bin'),
      path.join(home, '.cargo', 'bin'),
      programFiles,
    ];
  }
  return [
    path.join(home, '.local', 'bin'),
    path.join(home, '.bun', 'bin'),
    path.join(home, '.cargo', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
  ];
}

export const agentDetector = new AgentDetector();

export { mergePaths };
