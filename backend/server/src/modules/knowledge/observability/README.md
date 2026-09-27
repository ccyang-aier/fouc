# Knowledge observability

G02 turns every gateway model call into a durable `ai_usage` row and one OpenTelemetry client span. The gateway itself stays untouched: `startKnowledgeObservability({ pool, ... })` returns the `onCall` hook to hand to `createModelGateway`, plus `observeGateway` which wraps an existing gateway so each call becomes span `fouc.ai.<operation>`.

```ts
const observability = await startKnowledgeObservability({ pool, onDiagnostic: log });
const gateway = observability.observeGateway(createModelGateway({ ...config, onCall: (record) => observability.onModelCall(record) }));
// later: await observability.close();
```

## Decisions

- **Usage writes commit in their own short tenant transaction, never the caller's business transaction.** Provider tokens were consumed the moment the provider answered; rolling back a business write must not erase real spend, and usage must survive a process crash right after the call. The row is inserted through `withKnowledgeTenant` and committed before the call result is returned, so committed usage is never lost to a later crash. A failed insert (database outage, foreign key) does not fail the model call: it emits one sanitized `usage_persist_failed` diagnostic and a span event. The gateway's `observation_failed` path therefore stays reserved for handlers that break their own contract.
- **Unreported tokens are null, not zero.** `ai_usage.input_tokens`/`output_tokens` are nullable; the old `NOT NULL DEFAULT 0` columns would have fabricated zero consumption. Failed calls before model resolution store null `provider`/`model`. `operation`/`status`/`error_code` columns make every failure queryable by fixed gateway codes — never upstream exception text.
- **Tracing is off until configured.** `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` or `OTEL_EXPORTER_OTLP_ENDPOINT` (standard OTel variables, plus `OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_SERVICE_NAME`) enable an OTLP/HTTP exporter; an explicit `spanProcessor` enables tracing without OTLP. Unconfigured means no OTel SDK import at all: spans are non-recording and usage rows store a null `trace_id` instead of referencing a trace that exists nowhere.
- **Streams re-scope every advance.** Async generators resume in the consumer's OpenTelemetry context, so the wrapper runs each `next()`/`return()` of the wrapped gateway inside the span context. The gateway's awaited `onCall` (including the cancellation path after a consumer break) therefore always sees the active span and can persist its trace id.
- **Attributes are an allowlist.** Spans, diagnostics and rows carry only call identity (`workspace_id`/`user_id`/`task_id`/`call_id`), model identity, operation, tier, fixed error codes, timing and reported usage. Prompts, responses, provider bodies, endpoints and credentials never enter them; span error status carries the gateway error code, not the cause.

## Verification

```powershell
bun test backend/server/src/modules/knowledge/observability
bun test backend/server/src/modules/knowledge/ai
pnpm backend:typecheck
pnpm exec eslint --no-ignore backend/server/src/modules/knowledge/observability
# Node smoke: bundle for Node, copy the SQL asset next to it, run the same suite.
bun build backend/server/src/modules/knowledge/observability/observability.test.ts --target=node --outfile .runtime/verification/knowledge/observability.test.mjs
Copy-Item backend/server/src/platform/database/current.sql .runtime/verification/knowledge/current.sql
node --test .runtime/verification/knowledge/observability.test.mjs
```

The suite uses the real AI SDK against synthetic protocol fixtures with a disposable PostgreSQL database (created and dropped per test) and a real local OTLP HTTP collector. Metrics/log export, sampling policy and collector deployment are outside G02; assembly is single-instance per process.
