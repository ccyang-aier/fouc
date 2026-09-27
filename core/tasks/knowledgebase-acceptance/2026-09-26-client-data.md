# U01 · TanStack Query 与 tRPC 客户端数据边界

2026-09-26。客户端数据层落地于 `src/features/knowledge/data/`，全部验证命令在本机真实执行并通过。类型链经 A00 的 type-only 入口推导，未运行时导入任何后端模块；未与真实已挂载的服务端做在线往返（Z03 尚未把 A00 装配到监听角色，见文末未验证边界）。

## 实现

- `api-types.ts`：仅 `export type` 复用 A00 `backend/src/api/knowledge/client-types.ts` 的 `KnowledgeApiRouter / KnowledgeApiInputs / KnowledgeApiOutputs`。该入口零运行时导出；架构扫描器允许该 type-only 反向引用，禁止任何值导入。
- `trpc-client.ts`：`createTRPCClient<KnowledgeApiRouter>` 类型安全调用面，URL 仅由 `knowledgeTrpcUrl`（`<origin>/api/knowledge/<workspaceId>/trpc`）这一个契约函数构造；`httpBatchLink` 按 A00 限制配置 `maxItems: 10`、`maxURLLength: 8192`，fetch 包装恒定 `credentials: 'include'`（Cookie 会话凭据）。每 (origin, workspace) 一个客户端实例缓存；`runKnowledgeCall` 统一执行包裹。
- `endpoint.ts`：桌面（Tauri）经 `get_backend_endpoint` 命令解析本地 sidecar origin（复用 `src/lib/backend.ts` 约定，不使用 sidecar token——知识库 API 认证是 Cookie 会话/PAT）；Web 用 `NEXT_PUBLIC_FOUC_API_URL`（仅 origin，禁 path/query/fragment/凭据）；Web dev 回退 `http://127.0.0.1:8710`，生产缺配置直接抛清晰错误，绝不静默回退。解析按文档生命周期记忆化一次。
- `errors.ts`：`KnowledgeDataError`（`code / requestId / httpStatus / cause`）领域错误；A00 全部 21 个允许错误码显式映射，未知服务码降级 `UNAVAILABLE`，无错误体的传输失败归 `NETWORK`，非 tRPC HTTP 响应归 `UNAVAILABLE` 并保留状态码。已中止的 `signal` 原样放行错误（取消不是错误，交由查询层自身语义）；`isRetryableKnowledgeError` 仅 NETWORK/UNAVAILABLE/RATE_LIMITED 可重试。
- `query-keys.ts`：workspaceId 为每个查询键的顶层命名空间（`[workspaceId, 'knowledge', …]`），提供类型化键工厂。
- `query-client.ts`：`createKnowledgeQueryClient` 默认重试策略为领域感知（仅瞬态错误、最多 2 次；mutation 不重试）；`invalidateKnowledgeQueries` 接受键工厂的 workspace 级或细粒度键。
- `provider.tsx` / `hooks.ts`：`KnowledgeQueryProvider` 挂载 QueryClient；`useKnowledgeAccessQuery` 作为首个组合样例（键工厂 + 类型客户端 + signal 穿透 + 错误归一），U02+ 按此模式扩展。
- `bun-test.d.ts`：仓库首批前端测试所需的最小 `bun:test` / `Bun.build` 本地类型面（根工程无 @types/bun 且不允许新增依赖、不动共享 tsconfig）；集中类型化 bun 测试后应删除此文件。

## 独立验证

```powershell
bun test src/features/knowledge/data
pnpm typecheck
pnpm exec eslint --max-warnings=0 src/features/knowledge/data
node scripts/verify-knowledge-boundaries.mjs
```

**29 项测试、125 断言、4 个文件全部通过**（约 100ms）。覆盖：origin 解析矩阵（桌面成功/命令失败/坏返回、Web 已配置/坏配置、dev 回退、生产缺配置、server 拒绝、记忆化）、URL 契约（路径、UUID 校验）、21 个服务错误码逐一映射 + 未知码降级 + requestId/httpStatus 保留 + 网络失败 + 非 tRPC 响应 + 取消放行 + 已归一透传 + 重试白名单、键形态与真实 `QueryClient` 上的跨 workspace 失效隔离（workspace 级命中本 workspace 全部键、另一 workspace 不受影响；细粒度键不越界）、以及**用假 fetch 驱动真实 `@trpc/client` 链路**验证 URL/`batch=1`/`credentials: 'include'`/abort 传播到传输 signal/响应解析，外加编译期断言（未知 procedure、缺失 workspaceId 均 `@ts-expect-error` 拒绝）。

类型检查通过：我的 13 个文件进入根程序，A00 的 48 个后端源文件经 type-only 链路进入类型检查且在根配置下零错误。浏览器目标 `Bun.build` 打包 `hooks.ts` 成功，产物不含 `backend/src`、`better-auth`、`postgres`、`node:crypto` 标记。定向 eslint（`--max-warnings=0`）与架构扫描器（148 个源文件，无反向运行时依赖）均通过。

## 未验证边界（诚实记录）

- **无在线往返**：本机 sidecar `127.0.0.1:8710` 探测 `GET /api/knowledge/<uuid>/trpc/access` 返回 404（旧全局 `/api/knowledge` 为 200）——A00 尚未由 Z03 挂载，真实 Cookie/PAT 往返、CORS/credentials 行为留给 Z03/U02 在真实装配后验收。
- **桌面端未实测**：未构建 Tauri、未在 WebView 里调用 `get_backend_endpoint`；桌面路径仅以注入依赖单测。WebView 跨站 Cookie 限制仍按认证 README 归 Z03。
- **Web 部署变量未接入配置样例**：`NEXT_PUBLIC_FOUC_API_URL` 已在代码与测试中生效，但 `.env.example` 归根仓库所有，本任务未改动，建议主线程补一行示例。
- `bun-test.d.ts` 为本地最小类型面，workspace 将来统一 `@types/bun` 时应删除；Provider/hooks 尚无页面消费者（属 U02+）。
