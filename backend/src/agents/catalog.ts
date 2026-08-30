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

/**
 * 桥接 Agent 的适配器以本地化工件运行（版本由 backend/package.json 锁定）：
 *  - 开发态：直接运行 backend/node_modules 下的入口（js 经 bun，native 直接执行）
 *  - 打包态：运行随应用分发的桥 sidecar（FOUC_BRIDGE_DIR 指向 exe 同目录）
 * 不再使用 `bun x`（编译后的后端 exe 无法充当 bun CLI，且运行时下载不可控）。
 */
export const PROVIDER_CATALOG: ProviderSpec[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    cliCommand: 'claude',
    acpLaunch: {
      kind: 'bridge',
      bridgeRuntime: 'js',
      entry: '@agentclientprotocol/claude-agent-acp/dist/index.js',
      binary: 'fouc-bridge-claude',
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
      bridgeRuntime: 'native',
      entry: '@zed-industries/codex-acp-win32-x64/bin/codex-acp.exe',
      binary: 'fouc-bridge-codex',
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
      bridgeRuntime: 'js',
      entry: '@tencent-ai/codebuddy-code/bin/codebuddy',
      binary: 'fouc-bridge-codebuddy',
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
