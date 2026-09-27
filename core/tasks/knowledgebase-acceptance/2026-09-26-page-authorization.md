# P03 · 权限一致的页面授权接口

日期：2026-09-26。模块：`backend/server/src/modules/knowledge/permissions/authorization.ts`、`backend/server/src/modules/knowledge/api/router.ts`（`page.access`）、`permissions-test-fixture.ts`（挂载真实 tRPC 边界）。

主代理实现并复核：授权入口 `authorizePageAccess` 在域租户事务内完成「验证成员行+群组行 → 主体展开 → 物化 ACL 判定」；tRPC `page.access` 查询逐动作授权。真实 HTTP/tRPC 客户端 + 真实队列 + 普通 RLS 角色验证：

```powershell
bun test backend/server/src/modules/knowledge/permissions backend/server/src/modules/knowledge/api
pnpm exec eslint --no-ignore backend/server/src/modules/knowledge/permissions backend/server/src/modules/knowledge/api
node scripts/verify-knowledge-boundaries.mjs
```

**48 tests / 0 fail / 432 assertions**（P03 新增 `authorization.integration.test.ts` 5 项），定向 lint 零告警，架构边界 143 文件通过。（`pnpm backend:typecheck` 与 G02 并行进行，在两者完成后统一复验通过。）

## 通过的实际流程（逐条对应验收标准）

- **查看/评论/编辑/full 动作逐一授权**：对 `comment` 级被授权者，四个动作逐一判定 view/comment 放行、edit/full 拒绝；`full` 级被授权者四个动作全部放行；服务返回实际级别与 revision。
- **API/WS/AI 共用入口**：`authorizePageAccess(db, { userId, scope, required })` 是唯一入口——本任务由 tRPC 过程在 `ctx.withTenant` 内消费；B01 WS 握手与 J02/J03 Agent 工具按同一签名在其各自事务内调用（接线属后续任务）。主体始终来自本事务内验证的 member/groupMember 行，不接受请求体主体。
- **无权限目标不可通过 ID 猜测访问**：不存在、已回收、未授权、非成员四类在服务层统一 `deny`；HTTP 层把围栏期 `rebuilding` 也折叠为普通 deny——被拒的已存在页面与随机不存在页面的响应除调用者自己回显的 pageId 外逐字段一致（含键集合）。
- **附加边界**：围栏期服务层向内部调用方返回 `rebuilding`（可重试），HTTP 面拒绝；群组授权在成员移除后即时拒绝（展开时生效）；fixture 现以真实 Better Auth 会话 Cookie 经 `createKnowledgeApiRoutes` 打通 tRPC 全链路。

## 明确边界

不含页面内容/元数据读写（T01+）、WS 升级握手（B01）、AI/MCP 工具（J02/J03）与分享链接主体（P04）；本任务不新增锁协议——并发撤权围栏由 P02 在域事务中保证。PAT 凭证路径经 A00/A03 认证器已覆盖，未在本测试重复展开。
