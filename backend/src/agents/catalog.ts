/**
 * @license
 * 目录数据转写自 AionUi (aionui.com) 的 src/common/types/acpTypes.ts
 * ACP_BACKENDS_ALL（Apache-2.0），Copyright 2025 AionUi (aionui.com)，
 * 按 Apache-2.0 授权复用并修改；桥接启动行与 behavior_policy 参考
 * AionCore（iOfficeAI/AionCore）的 001_initial_schema.sql 种子。
 *
 * 每个受管 Agent 是一条声明：命令名 + ACP 启用方式（原生子命令或桥接包）。
 * 新增 Agent = 增加一条目录数据，不新增协议代码。
 */

import type { ProviderSpec } from '@shared/index';

export const CODEX_ACP_BRIDGE_VERSION = '0.9.5';
export const CLAUDE_ACP_BRIDGE_VERSION = '0.29.2';
export const CODEBUDDY_ACP_BRIDGE_VERSION = 'latest';

/**
 * 桥接包统一经 `bun x --bun <pkg>@<version>` 启动（AionCore 生产验证）。
 * Fouc 后端自身运行于 Bun，桥运行时即后端自身二进制，无需用户安装 Node。
 */
export const PROVIDER_CATALOG: ProviderSpec[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    cliCommand: 'claude',
    acpLaunch: {
      kind: 'bridge',
      pkg: '@agentclientprotocol/claude-agent-acp',
      version: CLAUDE_ACP_BRIDGE_VERSION,
      bridgeBinary: 'bun',
    },
    authRequired: true,
    skillsDir: '.claude/skills',
    defaultEnabled: true,
    behaviorPolicy: { sessionLoadViaMetaField: true, yoloModeId: 'bypassPermissions' },
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    cliCommand: 'codex',
    acpLaunch: {
      kind: 'bridge',
      pkg: '@zed-industries/codex-acp',
      version: CODEX_ACP_BRIDGE_VERSION,
      bridgeBinary: 'bun',
    },
    authRequired: true,
    skillsDir: '.codex/skills',
    defaultEnabled: true,
    behaviorPolicy: { yoloModeId: 'fullAccess' },
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    cliCommand: 'opencode',
    acpLaunch: { kind: 'native', args: ['acp'] },
    authRequired: false,
    skillsDir: '.opencode/skills',
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'qwen',
    name: 'Qwen Code',
    cliCommand: 'qwen',
    acpLaunch: { kind: 'native', args: ['--acp'] },
    authRequired: true,
    skillsDir: '.qwen/skills',
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'goose',
    name: 'Goose',
    cliCommand: 'goose',
    acpLaunch: { kind: 'native', args: ['acp'] },
    authRequired: false,
    skillsDir: '.goose/skills',
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'auggie',
    name: 'Augment Code',
    cliCommand: 'auggie',
    acpLaunch: { kind: 'native', args: ['--acp'] },
    authRequired: false,
    skillsDir: null,
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'kimi',
    name: 'Kimi CLI',
    cliCommand: 'kimi',
    acpLaunch: { kind: 'native', args: ['acp'] },
    authRequired: false,
    skillsDir: '.kimi/skills',
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'droid',
    name: 'Factory Droid',
    cliCommand: 'droid',
    acpLaunch: { kind: 'native', args: ['exec', '--output-format', 'acp'] },
    authRequired: false,
    skillsDir: '.factory/skills',
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    cliCommand: 'copilot',
    acpLaunch: { kind: 'native', args: ['--acp', '--stdio'] },
    authRequired: false,
    skillsDir: null,
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'cursor',
    name: 'Cursor Agent',
    // 注意：Cursor CLI 使用通用命令名 "agent"，`which agent` 可能命中其他
    // 工具（AionUi 目录注释明确承认此歧义）。Fouc 靠探测身份校验兜底。
    cliCommand: 'agent',
    acpLaunch: { kind: 'native', args: ['acp'] },
    authRequired: true,
    skillsDir: '.cursor/skills',
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'kiro',
    name: 'Kiro',
    cliCommand: 'kiro-cli',
    acpLaunch: { kind: 'native', args: ['acp'] },
    authRequired: true,
    skillsDir: null,
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'codebuddy',
    name: 'CodeBuddy',
    cliCommand: 'codebuddy',
    acpLaunch: {
      kind: 'bridge',
      pkg: '@tencent-ai/codebuddy-code',
      version: CODEBUDDY_ACP_BRIDGE_VERSION,
      bridgeBinary: 'bun',
    },
    authRequired: true,
    skillsDir: '.codebuddy/skills',
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'qoder',
    name: 'Qoder CLI',
    cliCommand: 'qodercli',
    acpLaunch: { kind: 'native', args: ['--acp'] },
    authRequired: false,
    skillsDir: null,
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'vibe',
    name: 'Mistral Vibe',
    cliCommand: 'vibe-acp',
    acpLaunch: { kind: 'native', args: [] },
    authRequired: false,
    skillsDir: '.vibe/skills',
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    cliCommand: 'hermes',
    acpLaunch: { kind: 'native', args: ['acp'] },
    authRequired: true,
    skillsDir: null,
    defaultEnabled: true,
    behaviorPolicy: {},
  },
  {
    id: 'snow',
    name: 'Snow CLI',
    cliCommand: 'snow',
    acpLaunch: { kind: 'native', args: ['--acp'] },
    authRequired: false,
    skillsDir: null,
    defaultEnabled: true,
    behaviorPolicy: {},
  },
];

/** 目录命令名白名单（拼入 shell 前的注入防线） */
export function isCatalogCommandSafe(command: string): boolean {
  return /^[a-zA-Z0-9_.-]+$/.test(command);
}
