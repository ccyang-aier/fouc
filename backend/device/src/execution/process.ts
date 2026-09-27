/**
 * @license
 * 优雅关闭与进程工具移植自 AionUi (aionui.com) 的
 * src/process/acp/infra/processUtils.ts（Apache-2.0），
 * Copyright 2025 AionUi (aionui.com)，按 Apache-2.0 授权复用并修改。
 *
 * F1 本地安全执行内核的进程面：所有外部子进程（Agent CLI、桥、探测命令）
 * 必须经由此处的构造器创建，禁止散落裸 spawn。
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { prepareCleanEnv, getWindowsShellExecutionOptions } from '../platform/env';

// ─── 命令行拆分（支持引号与转义） ──────────────────────────────────

export function splitCommandLine(cmd: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const char of cmd) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        parts.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (escaping) current += '\\';
  if (quote) throw new Error('splitCommandLine: unterminated quote');
  if (current.length > 0) parts.push(current);
  if (parts.length === 0) throw new Error('splitCommandLine: empty command');
  return parts;
}

// ─── 进程等待原语 ──────────────────────────────────────────────────

export function waitForSpawn(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSpawn = () => {
      child.off('error', onError);
      resolve();
    };
    const onError = (err: Error) => {
      child.off('spawn', onSpawn);
      reject(err);
    };
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });
}

export function waitForExit(child: ChildProcess, timeoutMs: number): Promise<number | null> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      child.off('exit', onExit);
      child.off('close', onExit);
      clearTimeout(timer);
      resolve(value);
    };
    const onExit = (code: number | null) => finish(code);
    const timer = setTimeout(() => finish(null), timeoutMs);
    child.once('exit', onExit);
    child.once('close', onExit);
  });
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 三阶段优雅关闭：stdin close → 等待 grace → SIGTERM → SIGKILL */
export async function gracefulShutdown(child: ChildProcess, gracePeriodMs = 100): Promise<void> {
  if (child.stdin && !child.stdin.destroyed) child.stdin.end();
  const code1 = await waitForExit(child, gracePeriodMs);
  if (code1 !== null) return;
  try {
    child.kill('SIGTERM');
  } catch {
    /* already dead */
  }
  const code2 = await waitForExit(child, 1500);
  if (code2 !== null) return;
  try {
    child.kill('SIGKILL');
  } catch {
    /* already dead */
  }
  await waitForExit(child, 1000);
  child.unref();
}

// ─── Spawn 构造器（对应 AionCore Builder::agent / clean_cli 双预设） ─

export interface AgentSpawnSpec {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  /** POSIX 上脱离父进程会话（父退出不拖死子进程；终止时走进程组 kill） */
  detached?: boolean;
}

/** 长驻 Agent CLI：pipe stdio、干净环境、可选 detached */
export function spawnAgentProcess(spec: AgentSpawnSpec): ChildProcess {
  const isWindows = process.platform === 'win32';
  const command = spec.command;
  const isCommandName = !pathLike(command);
  // Windows 上命令名（非路径）需要 shell 解析 .cmd/.bat shim；
  // 我们的目录命令名经过白名单校验，参数不含用户自由文本。
  const useShell = isWindows && isCommandName;
  const child = spawn(command, spec.args, {
    cwd: spec.cwd,
    env: spec.env as NodeJS.ProcessEnv | undefined,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: spec.detached ?? !isWindows,
    shell: useShell,
    windowsHide: true,
  });
  if ((spec.detached ?? !isWindows) && !isWindows) child.unref();
  return child;
}

/** 短命命令（版本探测、which/where 等）：一次性执行并收集输出 */
export async function runCleanCli(
  command: string,
  args: string[],
  options?: { timeoutMs?: number; env?: Record<string, string>; cwd?: string }
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const isWindows = process.platform === 'win32';
  const useShell = isWindows && !pathLike(command);
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        cwd: options?.cwd,
        env: options?.env as NodeJS.ProcessEnv | undefined,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: useShell,
        windowsHide: true,
        ...(useShell ? getWindowsShellExecutionOptions() : {}),
      });
    } catch (error) {
      resolve({ code: null, stdout: '', stderr: String(error), timedOut: false });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* best-effort */
      }
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', (error) => {
      clearTimeout(timer);
      stderr += String(error);
      resolve({ code: null, stdout, stderr, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

/** 异步版本探测命令（不阻塞调用方） */
export function execVersionProbe(
  command: string,
  args: string[],
  env: Record<string, string>,
  timeoutMs: number
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return runCleanCli(command, args, { timeoutMs, env });
}

function pathLike(command: string): boolean {
  return (
    /^[a-zA-Z]:[\\/]/.test(command) ||
    command.startsWith('/') ||
    command.startsWith('\\') ||
    command.startsWith('.') ||
    command.includes('/') ||
    command.includes('\\')
  );
}

/** 预备干净环境的便捷出口（供探测/连接复用） */
export { prepareCleanEnv };
