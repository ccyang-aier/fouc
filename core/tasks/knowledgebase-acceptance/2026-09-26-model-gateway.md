# G01 · 统一模型网关

2026-09-26。主代理实现、复核并运行官方 AI SDK 协议测试、真实 GLM、真实本机 Ollama 与隔离 PostgreSQL 验证。

## 已验证的边界

- `createModelGateway` 是知识库模型的唯一运行入口；架构扫描同时覆盖领域层和 API。提供生成、真实流、向量、重排；模型配置显式选择，不静默替换模型。
- 云平台与每用户/工作区 BYOK 经过服务端精确端点许可；AES-256-GCM 加密并绑定租户、用户、供应商和目的端点，每次读取有效凭据，撤销后立即拒绝。Ollama 不携带平台密钥。
- 官方 OpenAI-compatible、Anthropic、Cohere 适配器；拒绝重定向、超大响应、非授权媒体 URL、嵌套工具媒体与执行函数。工具仅产生惰性提案，不执行模型指令。
- 输入预算按 UTF-8 计数，涵盖文本、工具 schema、向量文档与重排 query；媒体、输出、重试、超时均有限。调用者取消、截止时间与提前退出流都关闭真实 HTTP 请求。
- 事件只有调用身份、模型、状态、耗时、实际用量；没有正文/密钥/上游异常。未报告 token 为 null，不伪造零。G02 承担落库与 tracing，本项未冒充已经持久化。

## 可复现验证

```powershell
bun test backend/src/knowledge/ai
pnpm backend:typecheck
pnpm exec eslint --no-ignore backend/src/knowledge/ai/gateway backend/scripts/knowledge-model-check.ts backend/scripts/knowledge-ollama-check.ts
bun build backend/src/knowledge/ai/gateway/gateway.test.ts --target=node --outfile backend/node_modules/.cache/knowledge/gateway.test.mjs
node --test backend/node_modules/.cache/knowledge/gateway.test.mjs
bun backend/scripts/knowledge-model-check.ts
bun backend/scripts/knowledge-ollama-check.ts
```

21 项 Bun 测试通过；网关 16 项在 Node 24.16.0 再通过。类型与定向 lint 通过。测试含真实套接字取消、流错误、惰性工具、多协议、UTF-8/媒体预算、异常脱敏、不可用能力、观察失败、未报告 token、向量维度与重排索引校验；隔离普通 RLS 角色数据库创建后销毁并确认不存在。

## 真实 GLM 验收

使用用户指定 `glm-5.3-flash` / Coding Chat Completion 端点，仅发送合成的简短测试提示，密钥只从 gitignored 本地配置读取，不写入证据或 Git。

| 调用 | 状态 | 耗时 | 输入/输出 token |
| --- | --- | --- | --- |
| 平台生成 | success | 13905 ms | 17 / 3 |
| 平台流式（1 个实际 delta） | success | 856 ms | 17 / 3 |
| PG 加密 BYOK 生成 | success | 1001 ms | 17 / 3 |
| BYOK 撤销后调用 | credential_unavailable | 3 ms | null / null |

本次真实成功调用合计 60 token；撤销后无外部请求。测试只使用自己创建的 UUID 临时库，主业务库未改动。

## 真实 Ollama 验收

官方 Ollama 0.34.4 的独立容器、仅回环 `127.0.0.1:11434`，2 CPU / 2 GiB，命名卷持久化。模型下载后校验完整 SHA-256：

- smollm2:135m-instruct-q4_K_M：105454144 字节，`8030f04528538d47bda434f6f0bdf3952c40a58123e4d5e755332f23731a8684`。
- all-minilm：45949216 字节，`797b70c4edf85907fe0a49eb85811256f65fa0f7bf52166b147fd16be2be4662`。

经过同一官方 SDK 网关生成（1922 ms，36/21 token）、流式（693 ms，9 个 delta，36/10 token）与 2×384 向量（506 ms，13/0 token）均成功。向量有限、非零且两个文本不产生相同向量；没有读取云密钥。

Anthropic/Cohere/视觉只验证协议与边界，不宣称所有收费模型都已实测；实际多模态、检索、工具执行与任务编排由后续 DAG 节点验收。保留 Web dev 常驻，没有构建 Tauri。
