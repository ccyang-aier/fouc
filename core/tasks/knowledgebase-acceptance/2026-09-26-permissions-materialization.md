# P02 · 有效权限物化、失效围栏与索引同步

日期：2026-09-26。模块：`backend/server/src/modules/knowledge/permissions/`（locking/mutations/fence/projection/queries/rebuild）与 `organization/teamspaces.ts` 根默认权限接线。

主代理复核实现并以真实身份、真实 graphile-worker 队列、普通 RLS 角色租户事务运行新增集成验收：

```powershell
bun test backend/server/src/modules/knowledge/permissions backend/server/src/modules/knowledge/organization shared/src/knowledge/contracts/organization.test.ts
pnpm backend:typecheck
pnpm exec eslint --no-ignore backend/server/src/modules/knowledge/permissions
node scripts/verify-knowledge-boundaries.mjs
```

**54 tests / 0 fail / 446 assertions**（本任务新增 `permissions.integration.test.ts` 10 项 / 71 断言），类型、定向 lint、架构边界全通过。fixture 使用真实邮箱会话、组织服务与一次性 disposable 数据库，逐库删除确认。

## 通过的实际流程（逐条对应验收标准）

- **授权/移动/断继承批量子树重算**：根授权使 4 页子树围栏失效（`pagesInvalidated=4`，aclRevision+1）；worker 消费 `acl.changed` 后沿 path<@ 子树重算，page/block 两类谓词恢复判定。断继承节点下方授权被切断、恢复继承后重新派生；子树移动到新父后失去原谱系授权、获得新谱系授权。
- **撤权立即阻止旧 ACL 泄漏**：清空授权的围栏事务内同步清空 `page_effective_acl` 四级数组与 `block_index.principals` 并保留旧 revision——重建完成前页面/块谓词与 `readMaterializedPagePermissions` 均 fail closed（pending），不残留任何旧授权；重建后保持关闭。
- **GIN 主体数组与 block_index 同步**：重算完成后 `page_effective_acl.view` 与该页全部 `block_index.principals`/`acl_revision` 一致；`withPermissionIndexWrite` 在同一写锁下读取当前物化并覆盖调用方携带的陈旧投影（伪造 `user:ghost`/revision 0 的块被纠正）。
- **群组变更无需逐页重算**：群组授权物化后，将成员移出群组即时生效（主体展开在查询时进行），期间 outbox/acl.changed 数量、job 数、全部页面 revision 零变化。
- **附加边界**：Teamspace 根默认权限变更在原 409 守卫位置改为同事务整空间围栏+逐根入队，HTTP 真实往返验证默认权限收紧/放宽；重叠事件合并（重复重放对已最新子树返回 rebuilt=0，全部页面 materialized revision == aclRevision）；并发授权与根默认变更串行收敛；跨租户谓词互不可见；回收页子树物化为空且读取返回 unavailable。

## 实现要点与修复

- 写协议统一为 workspace→teamspace→page 三级 `FOR UPDATE` 锁序，围栏/重建/索引投影共用。
- 修复 drizzle `sql` 模板把 JS 数组渲染成 `(a, b)` 记录语法导致的 `cannot cast type record to text[]`：主体数组参数一律经 `sql.param()` 绑定（`queries.ts` 两处 GIN 谓词）。
- 重建是当前态重算而非事件回放：畸形谱系（环、跨租户父子、path 不一致）抛 `INVALID_PERMISSION_TREE` 而不是猜测继承。

## 明确边界

本任务是内部服务与队列消费者，不含 HTTP 授权接口/发起者上下文（P03）、H01 索引管线本体（仅提供 `withPermissionIndexWrite` 端口）与分享链接主体（P04）。锁协议不做授权判断；`acl.changed` 事件消费依赖 Q01 的 graphile-worker 运行时。
