/**
 * Claude Code 桥 sidecar 入口：由 scripts/build-backend.mjs 编译为
 * fouc-bridge-claude（单文件 Bun 可执行）。适配器在单文件形态下需经
 * claude-agent-sdk 的 embed 导出解析 CLI，故先置位其开关再加载。
 */

process.env.CLAUDE_AGENT_ACP_IS_SINGLE_FILE_BUN ??= '1';
await import('@agentclientprotocol/claude-agent-acp/dist/index.js');

export {};
