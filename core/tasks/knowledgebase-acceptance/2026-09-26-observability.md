# G02 · OpenTelemetry 与 AI 用量

2026-09-26。主代理实现 observability 模块并以真实 PostgreSQL（一次性库）、真实 AI SDK 协议 fixture、真实本地 OTLP HTTP collector 与 Node 24 冒烟验证。

## 已验证的边界

- 每次（成功/失败/取消）网关调用落一行 `knowledge.ai_usage`：operation、status、tier、provider/model（模型解析前失败的调用为 null，不伪造）、input/output token（未报告为 null，不伪造零）、duration_ms、workspace/user/task 标识、error_code（固定网关错误码，永不含上游异常正文）与 trace_id。写入走 D02 请求级租户事务 `withKnowledgeTenant`，受 RLS 约束。
- 每次调用产生一个 `fouc.ai.<operation>` CLIENT span；span 与 usage 行通过 trace_id（落库列）与 `fouc.ai.call_id`（span 属性 = usage 主键）双向关联。流式调用对内层生成器的每次 `next()/return()` 重新进入 span 上下文，消费者提前退出（cancelled 路径）时 onCall 仍处于 span 作用域内，trace 关联不丢失。
- OTLP HTTP exporter 由标准 `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` / `OTEL_EXPORTER_OTLP_ENDPOINT`（+`_HEADERS`、`OTEL_SERVICE_NAME`）启用，或显式注入 SpanProcessor；未配置时不报错、不 import 任何 OTel SDK 重模块（零开销降级，span 非记录、trace_id 存 null）。非法端点在启动期拒绝且错误信息不回显端点值。
- 属性为白名单：仅调用身份、模型身份、operation/tier、固定错误码、耗时与实际用量；提示词、响应、provider 正文、端点与密钥不进入 span/日志/usage 行。usage 落库失败不影响调用结果返回：单条脱敏诊断 + span 事件，不再有第二条路径。

## 关键决策：usage 写事务策略

usage **不并入**业务写事务，而是在调用结束时经自己的短租户事务立即提交（网关在 `end()` 中 await onCall，行在结果返回前已提交）。理由：

1. token 在 provider 应答那一刻已经消耗；业务回滚若连带回滚 usage 会造成真实用量漏记。
2. 反向耦合同样错误：计量故障不应把已成功的模型调用变成用户可见的失败。G02 选择可用性优先——落库失败仅产出脱敏诊断与 span 事件，不抛入网关（网关 `observation_failed` 保留给破坏自身契约的观察者）。
3. 「进程崩溃前已提交的用量不丢」由即提交语义满足：行在调用返回前已跨连接可见（测试以另一连接验证）；仅存调用完成到提交之间的窗口，与任何写入相同。

配套 schema 重写（纯净原则，无 migration）：`ai_usage` token 列改可空（原 `NOT NULL DEFAULT 0` 会伪造零消耗）、provider/model 可空、新增 `operation`/`status`/`error_code` 列与 `ai_usage_outcome_valid` CHECK、`(workspace_id,status,created_at)` 索引；`current.sql` 由官方生成器重写并通过 `--check`。

## 可复现验证

```powershell
bun test backend/server/src/modules/knowledge/observability
bun test backend/server/src/modules/knowledge/ai
bun test backend/server/src/platform/database/knowledge
pnpm exec eslint --no-ignore backend/server/src/modules/knowledge/observability backend/server/src/platform/database/knowledge/schema/operations.ts backend/server/src/platform/database/knowledge/tenant-test-database.ts
bun backend/server/scripts/database-schema.ts --check
# Node 冒烟：打包同一套件并复制其 SQL 运行资产
bun build backend/server/src/modules/knowledge/observability/observability.test.ts --target=node --outfile .runtime/verification/knowledge/observability.test.mjs
Copy-Item backend/server/src/platform/database/current.sql .runtime/verification/knowledge/current.sql
node --test .runtime/verification/knowledge/observability.test.mjs
```

实测（2026-09-26）：observability 5 项通过（Bun 1.4.0 与 Node 24.16.0 各一次，一次性库创建后删除确认）；网关 21 项全绿；数据库 57 项全绿；定向 lint 无输出；schema `--check` 通过。全量 `pnpm backend:typecheck` 当时被并行任务的在途文件（`collaboration/page-collaboration-bun.ts`、`permissions/permissions-test-fixture.ts`，非本任务产物）阻塞；以临时隔离 tsconfig（observability + ai + database/knowledge + shared）验证本任务范围 `tsc --noEmit` 退出码 0，本模块自身亦在并行改动落地前通过过全量 typecheck。

覆盖的具体断言：成功/未报告 token/401 失败/凭据缺失四类调用的 usage 行；流式完成前落库、提前退出 cancelled 行与 span 收尾；跨连接即时可见性（提交即持久）；OTLP collector 实收 `POST /v1/traces`（application/json OTLP payload）内含 usage 行同一 trace_id 与 service.name；未配置模式 trace_id 为 null；诊断路径脱敏；对 usage 行、span 摘要、诊断与捕获的 console 输出断言无 API key、无提示词、无 provider 正文。

## 未验证边界

- 本套件用真实 AI SDK + 合成协议 fixture 与真实 PostgreSQL/OTLP，不再消耗真实云配额；真实 provider 下的用量由 G01 live 证据覆盖，G02 未重复。
- OTel metrics/logs exporter、采样策略（当前默认 AlwaysOn）、collector 部署运维与多实例同进程装配不在 G02；装配为每进程单实例，close() 后可重建。
- 后续 H02/H03 嵌入重建的批量调用会经由同一 onCall 路径自然记账；任务级聚合报表（按 task/user 汇总）属于上层查询，未在本文档声明。
