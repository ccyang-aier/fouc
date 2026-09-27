# J02 · 共用只读 Agent 工具

日期：2026-09-26。模块：`backend/server/src/modules/knowledge/ai/tools/`（新增：`registry.ts`/`types.ts`/`errors.ts`/`search.ts`/`read-page.ts`/`query-database.ts`/`list-pages.ts`/`get-backlinks.ts`/`index.ts` + `tools.integration.test.ts` 13 项）；共享契约新增 `shared/src/knowledge/contracts/agent-tools.ts`（barrel 追加一行导出）；`backend/server/src/modules/knowledge/search/indexer.ts` 把既有的 Y.Doc 正文解码抽为只读导出 `decodePageBody`（行为不变，供索引修复与工具读取共用同一解码）。前置：H04（`searchHybrid`）、M02（`createAiContext`/`read(range)` AI 方言）、T02（`listDatabaseRows`）、L01（`readPageBacklinks`）、P03（`authorizePageAccess`/`expandRequestPrincipals`/`effectivePageAccessCondition`）、B02（doc_state 唯一权威）、A03（`KnowledgeRequestContext`/`requireKnowledgeScopes`）。

## 可复现验证

```bash
bun test backend/server/src/modules/knowledge/ai/tools              # 13 pass / 0 fail / 91 expect
bun test backend/server/src/modules/knowledge/search                # 28 pass / 0 fail（indexer 抽取回归）
bun test backend/server/src/modules/knowledge/databases             # 18 pass / 0 fail（T02 依赖回归）
bun test shared/src/knowledge/contracts shared/src/knowledge/markdown   # 9 + 105 pass（契约/M02 回归）
pnpm shared:typecheck                                # 0 错误
pnpm exec eslint --no-ignore backend/server/src/modules/knowledge/ai/tools            # 0 告警（exit 0）
pnpm exec eslint --no-ignore shared/src/knowledge/contracts/agent-tools.ts backend/server/src/modules/knowledge/search/indexer.ts   # 0 告警
pnpm backend:typecheck                               # 本任务文件 0 错误（仓内仅存 import-export/export.ts 1 处，属并行 M03/M04 代理进行中的文件，非本任务产物）
```

真实环境：一次性 disposable RLS 数据库（`fouc_rls_*`，随建随删）、普通应用角色租户事务、`createPermissionsFixture` 真实 HTTP 认证（邮箱注册/验证/登录会话 + PAT 签发）、真实页面树与 P02 物化授权、真实 pg_search BM25 腿。无任何出网模型调用（工作区无生效嵌入模型与 rerank 绑定，两阶段按 H04 降级语义显式标注；网关 fetch 注入即抛错的桩证明零外呼）。

## 注册表形态（产品内 AI 与 MCP 共用）

- `knowledgeAgentTools`：`Object.freeze` 的五元数组，每项 `{ name, description, scopes, inputSchema, execute }`。`defineKnowledgeAgentTool` 在 `execute` 内先做 **A03 范围校验**（`requireKnowledgeScopes(authority, ['read'])`，会话/PAT 同一入口）再做 **zod 输入校验**，全部通过才进入 handler——按名分发（`invokeKnowledgeAgentTool`）与直取 `tool.execute` 两条路径同一防线。J03 写工具以同一 `defineKnowledgeAgentTool` 形态追加（`scopes: ['write']`）。
- 输入契约在 `shared/src/knowledge/contracts/agent-tools.ts`：`agentSearchToolInputSchema` 显式声明（查询词 1..200 与 H04 同界；`filters:{pageIds?,blockTypes?}`；limit 1..20）；read_page/query_database/list_pages/get_backlinks 分别由 `readPageInputSchema`/`queryDatabaseInputSchema`/`listPagesInputSchema`/`pageScopeSchema` `omit({workspaceId})` 派生——**workspaceId 与 principals 从不出现在工具输入**，与 C01/T02 语义逐字段一致。结果契约（`agentReadPageToolResultSchema` 等）同文件声明，handler 返回前 `parse` 自校验。
- 执行上下文 `KnowledgeAgentToolContext = { pool, authority: KnowledgeRequestContext, search?, signal? }`：工具层自行 `expandRequestPrincipals` 展开/授权，宿主（J04/K01）只负责装配已验证身份与（search 工具的）工作区模型绑定。

## 逐条验收证据（13 项真实测试）

1. **search 同发起者**（§9.2 `search(query, filters)`）：私有页（defaultAccess=null，仅 owner 授权）与共享页同词入库，owner 命中 3 块、reader 仅可见 2 块——两腿权限谓词内执行，`hybridSearchResultSchema.parse` 通过；`vectorLeg: no_active_model` 与 rerank 降级状态原样透传。`filters.pageIds/blockTypes` 在 H04 融合窗口（前 20）上收窄后截断到 limit（实测 headings 过滤、limit 1、pageIds 全外零命中）。
2. **read_page AI 方言**：P03 view 授权 → 同一租户快照读 doc_state + 标题 → `decodePageBody`（indexer 同款 y-prosemirror 解码）→ `createAiContext`。实测整页读含 `## 标题` 与每块 `{#b:id}` 锚点；嵌套列表段的 `parentBlockId` 指向其 listItem；顶层块 `parentBlockId: null`。
3. **range 越界拒绝**：range 所选块按**文档顺序**返回（请求逆序输入实测重排）、`markdown: null`；重复 ID、未知 ID、属于其他页面的合法格式 ID 三种越界一律 `INVALID_TOOL_RANGE`。
4. **query_database 复用 T02**：先对数据库页面 P03 view 授权，再以展开主体进 `listDatabaseRows`（行级 `effectivePageAccessCondition(view)`）。实测成员排序 desc + limit 2 → nextCursor 续页取回余行；select eq 过滤；成员正路径共享库全可见。
5. **list_pages 树/子树**：parentId 三态实测——缺省=整棵可见树（恰 4 页）、给定 id=该页子树（仅后代，不含自身）、null=仅根级；输出按 teamspace/position 定序，含 kind（doc/database/row）。
6. **get_backlinks**：目标页 P03 view 授权后走 L01 `readPageBacklinks`；owner 见私有来源页的 `{srcPageId, srcBlockId, dstBlockId}`，无来源页权限的成员 backlinks 为空（不泄漏来源存在性），目标页本身无权 → 拒绝。
7. **错误结构化且权限不足与不存在不可区分**：read_page/query_database 两工具实测「无权真实页 vs 随机 UUID」`code` 与 `message` 全等（`TARGET_NOT_ACCESSIBLE`）；未知工具 `UNKNOWN_TOOL`、伪造上下文（未签发对象）`UNAUTHENTICATED`、仅 write 范围 PAT 读工具 `INSUFFICIENT_SCOPE`、非法输入 `INVALID_TOOL_INPUT`、查询列/排序/游标不合法 `INVALID_TOOL_QUERY`、损坏 doc_state `TARGET_NOT_READABLE`（不可读而非不存在）、search 缺模型装配 `MODEL_DEPENDENCY_UNAVAILABLE`。
8. **回收页**：read_page 对已回收页 = `TARGET_NOT_ACCESSIBLE`（与不存在同文案）；list_pages 整树排除回收子树（回收根的后代随 P02 物化为空一并不可见）；以回收页为子树根的 list_pages 同样拒绝。
9. **link 主体不进成员工具路径**：真实 `createAuthorizedShareLink`（P04）在私有页上生成 `link:{id}` 授权并物化后，成员（reader）经工具读该页仍被拒——工具主体只含 user/group/workspace（`expandRequestPrincipals`），分享链接通道与 Agent 工具通道互不放大。
10. **非成员**：foreign（另一 workspace 成员）对 alpha 无法获得 `KnowledgeRequestContext`（`authenticate` 直接 `UNAUTHENTICATED`）——A03 边界先于工具层，工具输入中无任何可自报身份字段。
11. **空页**：正文从未持久化的页面返回 `{ markdown: '', blocks: [] }`（诚实空态，非错误）；空页带 range 请求 → `INVALID_TOOL_RANGE`。

## 关键决策与边界

- **search 过滤语义**：H04 `searchHybrid` 无过滤参数（其归属 H04/H05，本任务不改动 search/ 查询面）。工具层在融合窗口（重排候选前 20）上对命中做 pageIds/blockTypes 收窄再截断 limit——排序语义不受影响；窗口外是否存在更多匹配不臆测。`vectorLeg`/`rerank` 阶段状态原样透传。
- **read_page 不做 E02 修复**：只读工具绝不写权威状态。doc_state 解码失败或 blockId 完整性破损（`createAiContext` 抛 `invalid_anchor`）→ `TARGET_NOT_READABLE`；H01 索引消费者的修复通道负责让该页恢复可读。
- **query_database 双层可见性**：数据库页面本身 P03 view 授权 + 行级 T02 谓词。行可见不反推库页可见（断继承场景 fail closed），与产品侧列表语义一致。
- **list_pages 子树根先授权**：给定 parentId 时先 `authorizePageAccess(view)`，再以 `path <@ root` 取后代并逐页谓词过滤——可见祖先不放大不可见后代的暴露。未分页（与 `listPagesInputSchema` 契约一致，SaaS 规模下 J04/K01 可按 teamspaceId 分片）。
- **解码共用**：`search/indexer.ts` 抽出 `decodePageBody`（纯移动，`loadPageBodyModel` 语义不变；28 项 search 回归全过）。未在 tools/ 复制解码器，避免两份 y-prosemirror 解码漂移。
- **写工具（J03）**：insert/replace/delete/create/update_properties 不在本任务范围；注册表已按其形态预留（`scopes` 字段 + `defineKnowledgeAgentTool`）。

## 未尽边界

- `backend:typecheck` 全仓清零受并行任务（M03/M04 import-export）进行中文件影响；本任务全部文件（`ai/tools/**`、`agent-tools.ts`、`indexer.ts`）类型零错误。
- 真实模型链路（嵌入/重排端到端）沿用 H04 既有验收（`2026-09-26-hybrid.md`），本任务检索测试以受控降级路径验证工具层装配与谓词，不重复消耗真实模型调用。
