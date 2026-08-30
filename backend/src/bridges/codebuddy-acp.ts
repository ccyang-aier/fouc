/**
 * CodeBuddy 桥 sidecar 入口：由 scripts/build-backend.mjs 编译为
 * fouc-bridge-codebuddy（单文件 Bun 可执行），直接复用官方 CLI 入口。
 */

await import('@tencent-ai/codebuddy-code/bin/codebuddy');

export {};
