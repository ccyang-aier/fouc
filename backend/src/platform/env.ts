/**
 * @license
 * 本文件移植自 AionUi (aionui.com) 的 src/process/utils/shellEnv.ts
 * 与 src/process/agent/acp/acpConnectors.ts（Apache-2.0），
 * Copyright 2025 AionUi (aionui.com)，按 Apache-2.0 授权复用并修改。
 *
 * GUI/服务进程环境增强：合并 login shell PATH、扫描常见工具安装目录、
 * 清洗对子进程有害的继承变量。Fouc 后端自身运行于 Bun，
 * 因此 `bun` 可执行文件始终可用（process.execPath），
 * 桥接包不再依赖用户机器安装 Node。
 */

import { execFile, execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLogger } from './logger';

const log = createLogger('env');

// ─── login shell 环境（macOS/Linux） ───────────────────────────────

/** 需要从用户 shell 继承的环境变量（GUI 启动时可能缺失） */
const SHELL_INHERITED_ENV_VARS = [
  'PATH',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'REQUESTS_CA_BUNDLE',
  'CURL_CA_BUNDLE',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'OPENAI_API_KEY',
] as const;

let cachedShellEnv: Record<string, string> | null = null;

function resolveLoginShell(): string {
  if (process.platform === 'darwin') {
    try {
      const shell = execFileSync(
        'dscl',
        ['.', '-read', `/Users/${os.userInfo().username}`, 'UserShell'],
        { encoding: 'utf-8', timeout: 2000, stdio: ['pipe', 'pipe', 'pipe'] }
      )
        .trim()
        .split(/\s+/)
        .pop();
      if (shell && path.isAbsolute(shell)) return shell;
    } catch {
      /* dscl failed */
    }
    return '/bin/zsh';
  }

  if (process.platform === 'linux') {
    try {
      const passwd = execFileSync('getent', ['passwd', os.userInfo().username], {
        encoding: 'utf-8',
        timeout: 2000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      const shell = passwd.split(':').pop();
      if (shell && path.isAbsolute(shell)) return shell;
    } catch {
      /* getent failed */
    }
    return '/bin/bash';
  }

  return process.env.SHELL || '/bin/sh';
}

function loadShellEnvironment(): Record<string, string> {
  if (cachedShellEnv !== null) return cachedShellEnv;
  cachedShellEnv = {};

  // Windows 无 login shell 概念，跳过
  if (process.platform === 'win32') return cachedShellEnv;

  try {
    const shell = resolveLoginShell();
    if (!path.isAbsolute(shell)) return cachedShellEnv;
    // 用 -l（login）而非 -i（interactive）：交互式 shell 会 tcsetpgrp()
    // 抢占终端前台进程组且不恢复，导致 Ctrl+C 失效。
    const output = execFileSync(shell, ['-l', '-c', 'env'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HOME: os.homedir() },
    });
    for (const line of output.split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const key = line.substring(0, eq);
        const value = line.substring(eq + 1);
        if ((SHELL_INHERITED_ENV_VARS as readonly string[]).includes(key)) {
          cachedShellEnv[key] = value;
        }
      }
    }
  } catch (error) {
    log.warn('Failed to load shell environment:', error instanceof Error ? error.message : String(error));
  }
  return cachedShellEnv;
}

/** Promise 去重保护：并发调用共享一次 spawn，避免早到者拿到空环境 */
let fullShellEnvPromise: Promise<Record<string, string>> | null = null;

/** 加载用户 login shell 的全部环境变量（无白名单），供需要完整环境的 Agent 使用 */
export function loadFullShellEnvironment(): Promise<Record<string, string>> {
  if (!fullShellEnvPromise) fullShellEnvPromise = loadFullShellEnvironmentImpl();
  return fullShellEnvPromise;
}

function parseEnvOutput(output: string): Record<string, string> {
  const result: Record<string, string> = {};
  const varStartRe = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)/;
  let currentKey: string | null = null;
  let currentValue: string | null = null;
  for (const line of output.split('\n')) {
    const match = varStartRe.exec(line);
    if (match) {
      if (currentKey !== null) result[currentKey] = currentValue!;
      currentKey = match[1];
      currentValue = match[2];
    } else if (currentKey !== null) {
      currentValue += '\n' + line;
    }
  }
  if (currentKey !== null) result[currentKey] = currentValue!;
  return result;
}

async function loadFullShellEnvironmentImpl(): Promise<Record<string, string>> {
  if (process.platform === 'win32') return {};
  const shell = resolveLoginShell();
  if (!path.isAbsolute(shell)) return {};
  try {
    const output = await new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      // detached → 子进程新会话（setsid），交互式 shell 的 tcsetpgrp()
      // 在无控制终端的会话中无害，父进程 Ctrl+C 不受影响。
      const child = spawn(shell, ['-i', '-l', '-c', 'env'], {
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, HOME: os.homedir() },
      });
      child.unref();
      child.stdout!.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr!.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      child.on('error', reject);
      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          /* best-effort */
        }
        reject(new Error('Timed out loading full shell environment'));
      }, 5000);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new Error(`Shell exited with code ${code}: ${stderr.substring(0, 200)}`));
      });
    });
    const result = parseEnvOutput(output);
    log.info(`Full shell env loaded: ${Object.keys(result).length} vars`);
    return result;
  } catch (error) {
    log.warn('Failed to load full shell env:', error instanceof Error ? error.message : String(error));
    return {};
  }
}

// ─── 常见工具目录扫描 ───────────────────────────────────────────────

/** 合并两个 PATH 字符串，去重保序 */
export function mergePaths(path1?: string, path2?: string): string {
  const separator = process.platform === 'win32' ? ';' : ':';
  const paths1 = path1?.split(separator).filter(Boolean) || [];
  const paths2 = path2?.split(separator).filter(Boolean) || [];
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const p of [...paths1, ...paths2]) {
    if (!seen.has(p)) {
      seen.add(p);
      merged.push(p);
    }
  }
  return merged.join(separator);
}

/** 扫描 Windows 常见工具安装目录（快捷方式启动时 PATH 可能缺失这些路径） */
function getWindowsExtraToolPaths(): string[] {
  if (process.platform !== 'win32') return [];

  const homeDir = os.homedir();
  const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
  const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const currentPath = process.env.PATH || '';

  const candidates = [
    path.join(appData, 'npm'), // npm 全局包
    path.join(programFiles, 'nodejs'), // Node.js 官方安装器
    process.env.NVM_HOME || path.join(appData, 'nvm'), // nvm-windows
    process.env.NVM_SYMLINK || path.join(programFiles, 'nodejs'),
    ...(process.env.FNM_MULTISHELL_PATH ? [process.env.FNM_MULTISHELL_PATH] : []),
    path.join(localAppData, 'fnm_multishells'),
    path.join(homeDir, '.volta', 'bin'),
    process.env.SCOOP ? path.join(process.env.SCOOP, 'shims') : path.join(homeDir, 'scoop', 'shims'),
    path.join(localAppData, 'pnpm'),
    path.join(process.env.ChocolateyInstall || 'C:\\ProgramData\\chocolatey', 'bin'),
    // Git for Windows：Claude Code 的 agent-sdk 在 Windows 上调用 cygpath，
    // 缺失该目录会报 "cygpath: not found"
    path.join(programFiles, 'Git', 'cmd'),
    path.join(programFiles, 'Git', 'bin'),
    path.join(programFiles, 'Git', 'usr', 'bin'),
    path.join(programFilesX86, 'Git', 'cmd'),
    path.join(programFilesX86, 'Git', 'bin'),
    path.join(programFilesX86, 'Git', 'usr', 'bin'),
    'C:\\cygwin64\\bin',
    'C:\\cygwin\\bin',
    path.join(homeDir, '.bun', 'bin'),
    path.join(homeDir, '.cargo', 'bin'),
    path.join(homeDir, 'go', 'bin'),
    path.join(homeDir, '.deno', 'bin'),
    path.join(homeDir, '.local', 'bin'),
    path.join(localAppData, 'Programs'), // VS Code 风格用户级安装
  ];

  return candidates.filter((p) => existsSync(p) && !currentPath.includes(p));
}

/** 扫描 POSIX 常见工具安装目录 */
function getPosixExtraToolPaths(): string[] {
  if (process.platform === 'win32') return [];
  const homeDir = os.homedir();
  const currentPath = process.env.PATH || '';
  const candidates = [
    path.join(homeDir, '.bun', 'bin'),
    path.join(homeDir, '.cargo', 'bin'),
    path.join(homeDir, 'go', 'bin'),
    path.join(homeDir, '.deno', 'bin'),
    path.join(homeDir, '.local', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
  ];
  return candidates.filter((p) => existsSync(p) && !currentPath.includes(p));
}

let cachedEnhancedEnv: Record<string, string> | null = null;

/** 获取增强环境变量（shell env + process.env + 常见工具目录 + Bun 优先 PATH） */
export function getEnhancedEnv(customEnv?: Record<string, string>): Record<string, string> {
  if (cachedEnhancedEnv === null) {
    const shellEnv = loadShellEnvironment();
    const separator = process.platform === 'win32' ? ';' : ':';
    let mergedPath = mergePaths(process.env.PATH, shellEnv.PATH);

    const extraPaths =
      process.platform === 'win32'
        ? getWindowsExtraToolPaths().join(';')
        : getPosixExtraToolPaths().join(':');
    if (extraPaths) mergedPath = mergePaths(mergedPath, extraPaths);

    cachedEnhancedEnv = {
      ...process.env,
      ...shellEnv,
      PATH: mergedPath,
    } as Record<string, string>;
    void separator;
  }

  return {
    ...cachedEnhancedEnv,
    ...customEnv,
    PATH: customEnv?.PATH ? mergePaths(cachedEnhancedEnv.PATH, customEnv.PATH) : cachedEnhancedEnv.PATH,
  };
}

/** 重置缓存（用于刷新发现结果时让新装/卸载的 CLI 可见） */
export function clearEnvCache(): void {
  cachedShellEnv = null;
  cachedEnhancedEnv = null;
  fullShellEnvPromise = null;
}

/**
 * 为 Agent 子进程准备干净环境：
 * 完整 shell 环境（含用户自定义变量如 API Key）为基底，
 * 叠加增强 PATH，剥离对子进程有害的变量。
 */
export async function prepareCleanEnv(customEnv?: Record<string, string>): Promise<Record<string, string>> {
  const fullShellEnv = await loadFullShellEnvironment();
  const enhanced = getEnhancedEnv();
  const merged: Record<string, string | undefined> = { ...fullShellEnv, ...enhanced, ...customEnv };

  delete merged.NODE_OPTIONS;
  delete merged.NODE_INSPECT;
  delete merged.NODE_DEBUG;
  // 防止从 Claude Code 内启动 Fouc 时被 agent-sdk 检测为嵌套会话
  delete merged.CLAUDECODE;
  // 启动器注入变量不得泄入 Agent 子进程链：被当作 "bun" spawn 的运行时垫片
  // 会凭继承的 FOUC_BACKEND_PORT 误启服务器，与主后端撞端口形成崩溃循环
  delete merged.FOUC_BACKEND_PORT;
  delete merged.FOUC_BACKEND_TOKEN;
  delete merged.FOUC_DATA_DIR;
  // npm lifecycle 变量会干扰包解析
  for (const key of Object.keys(merged)) {
    if (key.startsWith('npm_')) delete merged[key];
  }

  return merged as Record<string, string>;
}

/** Windows 上执行命令需要 shell 解析 .cmd shim */
export function getWindowsShellExecutionOptions(): { shell?: boolean; windowsHide?: boolean } {
  return process.platform === 'win32' ? { shell: true, windowsHide: true } : {};
}

// ─── Node 版本管理器扫描（供桥回退到系统 npx 时使用） ───────────────

/** 扫描 nvm/fnm/volta 目录寻找满足最低版本要求的 Node bin 目录 */
export function findSuitableNodeBin(minMajor: number, minMinor: number): string | null {
  const homeDir = os.homedir();
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  const searchPaths: Array<{ base: string; binSuffix: string }> = [];
  const nvmDir = process.env.NVM_DIR || path.join(homeDir, '.nvm');
  searchPaths.push({ base: path.join(nvmDir, 'versions', 'node'), binSuffix: 'bin' });
  if (isMac) {
    searchPaths.push({
      base: path.join(homeDir, 'Library', 'Application Support', 'fnm', 'node-versions'),
      binSuffix: path.join('installation', 'bin'),
    });
  } else if (!isWin) {
    searchPaths.push({
      base: path.join(homeDir, '.local', 'share', 'fnm', 'node-versions'),
      binSuffix: path.join('installation', 'bin'),
    });
  }
  searchPaths.push({ base: path.join(homeDir, '.volta', 'tools', 'image', 'node'), binSuffix: 'bin' });

  const candidates: Array<{ major: number; minor: number; patch: number; binDir: string }> = [];
  for (const { base, binSuffix } of searchPaths) {
    try {
      for (const entry of readdirSync(base)) {
        const m = entry.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!m) continue;
        const major = parseInt(m[1], 10);
        const minor = parseInt(m[2], 10);
        const patch = parseInt(m[3], 10);
        if (major < minMajor || (major === minMajor && minor < minMinor)) continue;
        const binDir = path.join(base, entry, binSuffix);
        const nodeBin = path.join(binDir, isWin ? 'node.exe' : 'node');
        if (existsSync(nodeBin)) candidates.push({ major, minor, patch, binDir });
      }
    } catch {
      /* directory doesn't exist */
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.major - a.major || b.minor - a.minor || b.patch - a.patch);
  return candidates[0].binDir;
}
