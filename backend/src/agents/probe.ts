/**
 * @license
 * 探测错误分类移植自 AionUi (aionui.com) 的
 * AcpConnection.buildStartupErrorMessage（错误翻译模式）与 AionCore 的
 * cli_probe.rs（失败/超时/静默三态分类、双预算思想）（Apache-2.0）。
 *
 * probe = 无持久副作用的身份确认：
 *  1. 解析可执行路径
 *  2. 版本探测（区分快速失败=疑似损坏 / 超时=慢而非坏 / 静默成功）
 *  3. ACP initialize 握手（+ session/new 采集控制面后立即关闭）
 *  4. 产出 CapabilityManifest 与状态分类
 */

import os from 'node:os';
import path from 'node:path';
import type { AgentInstallation, InstallationStatus, ProviderSpec } from '@shared/index';
import { agentDetector } from './discovery';
import { buildLaunchSpec, matchesExpectedIdentity } from './launch';
import { ProcessAcpClient } from './driver/acp/client';
import { noopProtocolHandlers } from './driver/acp/types';
import { normalizeError } from './driver/acp/errors';
import { runCleanCli } from '../execution/process';
import { prepareCleanEnv, getEnhancedEnv } from '../platform/env';
import { buildCapabilityManifest, MIN_PROTOCOL_VERSION, type HandshakeEvidence } from './capability';
import { spawnAgentProcess } from '../execution/process';
import { createLogger } from '../platform/logger';

const log = createLogger('probe');

const CLI_VERSION_TIMEOUT_MS = 5_000;
const ACP_INIT_TIMEOUT_MS = 15_000;
/** 桥接包首次运行需下载安装（bun x 冷启动），握手预算放宽 */
const ACP_BRIDGE_INIT_TIMEOUT_MS = 90_000;

export type ProbeOutcome =
  | { ok: true; status: InstallationStatus; version: string | null; manifest: HandshakeEvidence & { skillsDir?: string }; durationMs: number }
  | { ok: false; status: InstallationStatus; errorCode: string; errorMessage: string; guidance: string; durationMs: number; stderr?: string };

export async function probeInstallation(provider: ProviderSpec, installation: AgentInstallation): Promise<ProbeOutcome> {
  const startedAt = Date.now();
  const duration = () => Date.now() - startedAt;

  // ── 阶段 1：路径解析 ──────────────────────────────────────────
  let executable = installation.executablePath;
  if (installation.source !== 'user_added') {
    const resolved = await agentDetector.resolveCliPath(provider.cliCommand);
    if (!resolved) {
      return {
        ok: false,
        status: 'missing',
        errorCode: 'command_not_found',
        errorMessage: `'${provider.cliCommand}' not found on PATH`,
        guidance: 'Install the CLI or add its path manually in Agent settings.',
        durationMs: duration(),
      };
    }
    executable = resolved;
  }

  // ── 阶段 2：版本探测（CLI 层） ─────────────────────────────────
  const env = getEnhancedEnv();
  const versionResult = await runCleanCli(executable, ['--version'], { timeoutMs: CLI_VERSION_TIMEOUT_MS, env });

  if (versionResult.timedOut) {
    // 超时 ≠ 损坏：健康但加载慢的 CLI（大体积、慢 I/O）
    return {
      ok: false,
      status: 'unhealthy',
      errorCode: 'version_probe_timeout',
      errorMessage: `\`${provider.cliCommand} --version\` timed out (${CLI_VERSION_TIMEOUT_MS}ms) — slow load, not proof of corruption`,
      guidance: 'Retry the health check; if it persists, the installation may be slow or damaged.',
      durationMs: duration(),
    };
  }
  if (versionResult.code !== 0 && versionResult.code !== null) {
    const detail = firstNonEmptyLine(versionResult.stderr) ?? firstNonEmptyLine(versionResult.stdout) ?? `exit ${versionResult.code}`;
    return {
      ok: false,
      status: 'unhealthy',
      errorCode: 'version_probe_failed',
      errorMessage: `\`${provider.cliCommand} --version\` failed: ${detail}`,
      guidance: 'The CLI installation appears broken — reinstall it.',
      durationMs: duration(),
      stderr: tail(versionResult.stderr, 512),
    };
  }
  const reportedVersion = firstNonEmptyLine(versionResult.stdout)?.slice(0, 200) ?? null;

  // ── 阶段 3：ACP 握手（协议层） ─────────────────────────────────
  const tempCwd = os.tmpdir();
  const spec = buildLaunchSpec(provider, { ...installation, executablePath: executable }, tempCwd);
  const initTimeoutMs = provider.acpLaunch.kind === 'bridge' ? ACP_BRIDGE_INIT_TIMEOUT_MS : ACP_INIT_TIMEOUT_MS;
  const client = new ProcessAcpClient(
    async () => {
      const cleanEnv = await prepareCleanEnv();
      return spawnAgentProcess({ command: spec.command, args: spec.args, cwd: spec.cwd, env: cleanEnv });
    },
    { backend: provider.id, handlers: noopProtocolHandlers, gracePeriodMs: 200 }
  );

  try {
    const initResult = await withTimeout(client.start(), initTimeoutMs, 'ACP initialize timed out');
    const typed = initResult as unknown as {
      protocolVersion?: number;
      agentInfo?: { name?: string; version?: string } | null;
      authMethods?: Array<{ id: string; name?: string }>;
      capabilities?: {
        loadSession?: boolean;
        promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
        mcpCapabilities?: { stdio?: boolean; http?: boolean; sse?: boolean };
        sessionCapabilities?: Record<string, unknown>;
      };
    };

    // 身份校验：agentInfo 不匹配期望 → 拒绝（防止同名伪 CLI）
    if (!matchesExpectedIdentity(provider.id, typed.agentInfo?.name ?? null)) {
      await safeClose(client);
      return {
        ok: false,
        status: 'incompatible',
        errorCode: 'identity_mismatch',
        errorMessage: `Agent identifies as "${typed.agentInfo?.name}" but provider "${provider.id}" expects one of its family`,
        guidance: 'This executable is not the expected agent — check the installation path.',
        durationMs: duration(),
      };
    }

    const protocolVersion = typed.protocolVersion ?? 0;
    if (protocolVersion < MIN_PROTOCOL_VERSION) {
      await safeClose(client);
      return {
        ok: false,
        status: 'incompatible',
        errorCode: 'incompatible_version',
        errorMessage: `ACP protocol version ${protocolVersion} is below supported minimum ${MIN_PROTOCOL_VERSION}`,
        guidance: 'Upgrade the CLI to a version with ACP support.',
        durationMs: duration(),
      };
    }

    // 阶段 3.5：session/new 采集控制面（模型/模式/配置项），随即关闭
    let models: HandshakeEvidence['models'] = [];
    let modes: HandshakeEvidence['modes'] = [];
    let configOptions: HandshakeEvidence['configOptions'] = [];
    try {
      const session = (await withTimeout(
        client.createSession({ cwd: tempCwd }),
        initTimeoutMs,
        'session/new timed out'
      )) as unknown as {
        sessionId?: string;
        models?: { availableModels?: Array<{ modelId?: string; name?: string; description?: string }> };
        modes?: { availableModes?: Array<{ id: string; name?: string; description?: string }> };
        configOptions?: Array<{ id: string; name?: string; type?: string; currentValue?: string }>;
      };
      models = (session.models?.availableModels ?? []).map((m) => ({
        id: m.modelId ?? '',
        name: m.name ?? m.modelId ?? '',
        description: m.description,
      }));
      modes = (session.modes?.availableModes ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id, description: m.description }));
      configOptions = (session.configOptions ?? []).map((opt) => ({
        id: opt.id,
        name: opt.name ?? opt.id,
        type: (opt.type as 'select' | 'boolean' | 'string') ?? 'string',
        currentValue: opt.currentValue,
      }));
      if (session.sessionId) {
        await client.closeSession(session.sessionId).catch(() => {});
      }
    } catch (error) {
      // 控制面采集失败不否定握手成功
      log.warn(`[${provider.id}] session/new probe failed: ${normalizeError(error).message}`);
    }

    const evidence: HandshakeEvidence = {
      protocolVersion,
      agentName: typed.agentInfo?.name ?? null,
      agentVersion: typed.agentInfo?.version ?? reportedVersion,
      loadSession: typed.capabilities?.loadSession === true,
      promptCapabilities: {
        image: typed.capabilities?.promptCapabilities?.image === true,
        audio: typed.capabilities?.promptCapabilities?.audio === true,
        embeddedContext: typed.capabilities?.promptCapabilities?.embeddedContext === true,
      },
      mcpCapabilities: {
        stdio: typed.capabilities?.mcpCapabilities?.stdio === true,
        http: typed.capabilities?.mcpCapabilities?.http === true,
        sse: typed.capabilities?.mcpCapabilities?.sse === true,
      },
      sessionCapabilities: {
        fork: !!typed.capabilities?.sessionCapabilities?.fork,
        resume: !!typed.capabilities?.sessionCapabilities?.resume,
        list: !!typed.capabilities?.sessionCapabilities?.list,
        close: !!typed.capabilities?.sessionCapabilities?.close,
      },
      authMethods: (typed.authMethods ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id })),
      models,
      modes,
      configOptions,
    };

    await safeClose(client);

    // 认证状态：握手成功但目录声明需要认证且无 env_var 方法可用 → needs_auth
    const status: InstallationStatus =
      provider.authRequired && evidence.authMethods.length === 0 ? 'needs_auth' : 'ready';

    return {
      ok: true,
      status,
      version: evidence.agentVersion ?? reportedVersion,
      manifest: evidence,
      durationMs: duration(),
    };
  } catch (error) {
    await safeClose(client);
    const normalized = normalizeError(error);
    const stderr = extractStderr(normalized);

    // CLI 不支持 ACP 模式的典型形态：打印帮助后正常退出（退出码 0 无输出）
    const noOutput = /exited? .{0,40}(code:? 0|signal: null)/i.test(normalized.message) && !stderr;
    return {
      ok: false,
      status: normalized.code === 'AUTH_REQUIRED' ? 'needs_auth' : 'unhealthy',
      errorCode: normalized.code === 'AUTH_REQUIRED' ? 'auth_required' : noOutput ? 'acp_init_failed' : classifyStartupError(normalized.message, stderr),
      errorMessage: translateStartupError(provider, normalized.message),
      guidance: 'Check that the CLI version supports ACP mode; upgrade if needed.',
      durationMs: duration(),
      stderr: tail(stderr ?? '', 512),
    };
  }
}

export function buildCapabilityFromEvidence(provider: ProviderSpec, evidence: HandshakeEvidence) {
  return buildCapabilityManifest(evidence, provider.skillsDir, provider.authRequired);
}

// ─── 工具 ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function safeClose(client: ProcessAcpClient): Promise<void> {
  try {
    await client.close();
  } catch {
    /* best effort */
  }
}

function firstNonEmptyLine(text: string): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function tail(text: string, max: number): string {
  return text.length > max ? text.slice(-max) : text;
}

function extractStderr(error: unknown): string | undefined {
  const err = error as { stderrSummary?: string; stderr?: string };
  return err?.stderrSummary ?? err?.stderr;
}

/**
 * 启动错误翻译（模式迁移自 AionUi buildStartupErrorMessage）：
 * 命令缺失 / 配置加载失败 / 不支持 ACP。
 */
function classifyStartupError(message: string, stderr?: string): string {
  const haystack = message + ' ' + (stderr ?? '');
  if (/not recognized|not found|No such file|command not found|ENOENT/i.test(haystack)) {
    return 'command_not_found';
  }
  if (/error loading config/i.test(haystack)) {
    return 'version_probe_failed';
  }
  if (/Cannot find (package|module)/i.test(haystack)) {
    return 'bridge_missing';
  }
  return 'acp_init_failed';
}

function translateStartupError(provider: ProviderSpec, rawMessage: string): string {
  if (/not recognized|not found|No such file|command not found|ENOENT/i.test(rawMessage)) {
    return `'${provider.cliCommand}' CLI not found. Install it or update the path in Agent settings.`;
  }
  if (/error loading config/i.test(rawMessage)) {
    return `${provider.name} failed to start due to a config file error. Review or temporarily rename the CLI config file and retry.`;
  }
  return rawMessage;
}

export { path };
