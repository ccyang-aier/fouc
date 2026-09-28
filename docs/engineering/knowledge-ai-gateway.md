# Knowledge model gateway

`createModelGateway` is the only knowledge runtime allowed to construct an AI SDK provider or call a model. The AST dependency check rejects direct provider/runtime imports elsewhere; type imports and the named tool/schema helpers remain allowed. Public capabilities are `generate`, `stream`, `embed`, and `rerank`.

Resolution uses F02's workspace tier binding or configured platform default. There is no implicit model substitution. BYOK is scoped to workspace, user and provider and is re-read for every call; revoked credentials cannot be reused from a cache. Ollama uses only a server-approved `/v1` base and never receives a cloud API key. OpenAI-compatible, Anthropic Messages and Cohere adapters are provided by pinned AI SDK packages, not handwritten response parsers.

## Boundaries

- Caller context is established by authenticated service code, never an HTTP body. Page/asset access and tool ACL checks occur in the domain/tool layer; the gateway does not infer authorization from a UUID.
- Endpoint allowlists are server-owned and matched exactly after URL normalization. The guarded provider fetch rejects redirects, query/credential URL substitution, unexpected SDK destinations and responses larger than 16 MiB (including streamed responses without Content-Length). Do not approve arbitrary user-provided endpoints or attach unrelated proxy headers.
- Vision receives already authorized `Uint8Array` media, at most 8 MiB per asset / 10 MiB combined input. No arbitrary media URL download is permitted. Nested tool media is rejected; tool context is text/JSON and vision media uses authorized top-level parts. The text/tool-schema budget is UTF-8 based, at most 1,000,000 bytes for non-vision input. This is a safety ceiling, not a retrieval token budget; H01/G03 still select and budget context for the chosen model.
- Calls have bounded retries (0–2), output tokens and timeout (at most 300 seconds). Caller abort, timeout and early async-iterator return close the network request. The streaming API exports only actual text deltas, inert tool proposals and the final usage/result—not provider raw events or hidden reasoning content.
- Tool definitions cannot contain `execute`. One generation step returns proposals; unknown/invalid tool calls fail. G03/G04 must validate proposal input and authorize/approve mutations. A model never executes a function through this gateway.
- Errors have fixed safe codes and retryability; they omit the provider body, URL, key and error cause. Records contain model identity, operation, timing, initiating context and usage only; never prompt/response content. Unreported token usage is `null`, not invented zero/NaN. Embeddings validate count, dimensions and finite values; reranking validates unique in-range indices.

## Credentials and observation

`createModelCredentialStore(pool, masterKey)` requires a server-owned 32-byte key. AES-256-GCM encrypts the provider secret with a fresh 12-byte nonce and binds workspace/user/credential/provider/endpoint as authenticated data. Metadata endpoints must not expose ciphertext or hashes. Key provisioning/backup is deployment responsibility; do not generate a new master key on every production startup, put it in frontend settings, or log it. The live acceptance script uses an ephemeral key only for its disposable database.

`onCall` is awaited exactly once for a started call, including provider/configuration failures and cancellation. A finished stream records before yielding its finish event. An observation failure is explicit (`observation_failed`); it must not silently imply that usage was persisted. SDK content telemetry is disabled. G02 owns durable usage and OpenTelemetry integration; this foundation does not pretend in-memory records are persisted tracing.

## Verification and live probes

```powershell
bun test backend/server/src/modules/knowledge/ai
bun backend/server/scripts/knowledge-model-check.ts
bun backend/server/scripts/knowledge-ollama-check.ts
```

The first command uses the real AI SDK against synthetic HTTP protocol fixtures, real socket abort/deadline checks and an isolated PostgreSQL credential store. It does not incur cloud usage. The explicitly invoked cloud probe reads `.env.knowledge.models.local` (gitignored) and sends synthetic prompts only. It verifies platform generation/streaming and encrypted BYOK/revocation and prints only usage/timing metadata. The local probe uses an already running approved Ollama with `smollm2:135m-instruct-q4_K_M` and `all-minilm` (384 dimensions); it does not download models implicitly.

Protocol fixtures are not a claim that every paid provider, vision model or reranker has been live-tested. Missing provider capabilities fail explicitly until a suitable configured endpoint is available.
