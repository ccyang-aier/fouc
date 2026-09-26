# 知识库基础阶段验收记录 · 2026-09-26

## F00 · 任务计划与 DAG

- 设计依据：`docs/product/V1/design/knowledgebase/fouc-knowledgebase-product-design.md`，已完整阅读 0–12 章及全部子节。
- 产物：`core/tasks/knowledgebase-tasks.json`（唯一状态源）、`core/tasks/fouc-knowledgebase-tasks.md`（生成任务表/完整 Mermaid DAG/覆盖矩阵）。
- 命令：`node scripts/verify-knowledge-tasks.mjs --write`；结果：97 tasks / 42 sections，无环、无未知依赖、无未覆盖章节。
- 命令：`node --test scripts/verify-knowledge-tasks.test.mjs`；结果：4 passed，包括独立分支拓扑排序、拒绝循环/未知依赖、拒绝漏章、拒绝无证据或前置未通过的验收。
- 架构审计：共享领域先于运行时服务；鉴权/权限先于 CRUD/协同，网关与索引先于检索和工具，MCP 复用工具；部署综合验收置于真实服务实现后。异步撤权窗口显式采用 fail closed；所有业务表都包含 workspace_id。
- 边界：本验收仅证明计划覆盖与追踪结构正确，不声称任何尚未实现的功能完成。

### DAG 人工复核补充

独立拆出 Teamspace 服务 O03、CRDT 来源/撤销内核 B00、服务端 Awareness B09，消除后端 AI 工具对客户端持久化/React 编辑器的逆向依赖。看板 U07 与日历 U11 独立并行验收。导入明确依赖正文持久化，Notion 数据库导入明确依赖行页面服务。共享历史差异算法不依赖后端检查点实现。

## F01 · 工作区与依赖边界

- 固定共享语义依赖版本：Tiptap/ProseMirror 3.31.3、Yjs 13.6.33、y-prosemirror 1.3.7、Zod 4.6.5、unified/remark；锁文件已更新。
- `pnpm shared:typecheck`、`pnpm backend:typecheck`：通过。
- `node node_modules/typescript/bin/tsc --noEmit --incremental false --generateTrace .next/knowledge-typecheck-trace`：退出 0，前端完整无缓存类型检查通过。原增量检查出现停滞，未把超时当成通过。
- `pnpm backend:test`：36 passed / 0 failed，151 assertions。
- `node --test scripts/verify-knowledge-tasks.test.mjs scripts/verify-knowledge-boundaries.test.mjs`：7 passed；覆盖共享代码误引 UI/Node、后端相对路径误引前端、前端只允许导入后端类型等边界。
- `pnpm knowledge:verify`：通过；边界扫描覆盖现有 19 个相关源文件。
- 边界：基础入口和防倒置校验已经就绪；功能模块及各自集成能力仍按后续任务验收。

## 初始回归与服务基线

- `pnpm backend:typecheck`：通过（只读审计执行）。
- `pnpm backend:test`：36 passed / 0 failed，13 files / 151 assertions（只读审计执行）。
- `http://localhost:3000/`：HTTP 200，Next dev PID 14720，复用并保持运行。
- 任务开始前已有 `next-env.d.ts` 生成变更，保留且不纳入本功能提交。
- Windows 未发现 Docker/Postgres/Redis/S3 服务；WSL 可用性在单独核查，不把 mock 结果记作真实设施验收。
