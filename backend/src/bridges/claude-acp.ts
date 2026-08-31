/**
 * Claude Code 桥 sidecar 入口：由 scripts/build-backend.mjs 编译进 fouc-backend
 * 单文件可执行，经 `--bridge claude-code` 分发。适配器（0.39+）依据
 * CLAUDE_CODE_EXECUTABLE 环境变量驱动用户自装的原生 claude 可执行，
 * 由 buildLaunchSpec 注入。
 */

await import('@agentclientprotocol/claude-agent-acp/dist/index.js');

export {};
