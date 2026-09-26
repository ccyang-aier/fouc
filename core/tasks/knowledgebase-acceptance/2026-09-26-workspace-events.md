# B06 · 工作区无状态事件与缓存失效

日期：2026-09-26。模块：`backend/src/knowledge/collaboration/events.ts`（hub/consumer/频道）+ 监听器集成（page-collaboration-bun.ts 路由分发）+ 前端 `src/features/knowledge/collaboration/workspace-events.ts` 与 query-keys 域段扩展。

主代理实现并验证：成员校验的 `/api/knowledge/:workspaceId/events` WebSocket 频道挂在协作监听器上（与页面文档传输并存、互不干扰）；graphile consumer 把 `workspace.event` outbox 事件扇出到本进程订阅者；频道无状态——不存任何每客户端游标。

```powershell
bun test backend/src/knowledge/collaboration
bun test src/features/knowledge/collaboration
pnpm exec eslint --no-ignore backend/src/knowledge/collaboration src/features/knowledge/collaboration src/features/knowledge/data
node scripts/verify-knowledge-boundaries.mjs
```

后端 **15 tests / 0 fail**（B06 新增 5 项：成员扇出/队列消费投递/工作区隔离/非成员与匿名 403/页面文档并存），B01/B02 共 10 项回归通过；前端 4 项（映射矩阵/URL 协议升级/重连补拉/畸形载荷容错）。lint 与边界通过。根 typecheck 的 6 个错误全部位于并行任务（T02 契约、O02 预览脚本）进行中文件，本任务文件零错误。

## 通过的实际流程（逐条对应验收标准）

- **ws:workspaceId 频道校验成员身份**：升级经 A03 认证器（会话 Cookie/PAT + Origin 边界 + 成员资格），非成员 Cookie 与匿名请求同得 403；页面文档连接不受影响（同监听器双通道分发实测）。
- **树/评论/通知/行事件只失效相关 Query**：前端 `invalidationSegmentsForEvent` 把 9 种契约事件映射到 pages/access/comments/notifications/databases/assets/aiTasks 键段（U01 键工厂扩展），测试覆盖全部映射;非法载荷不中断订阅。
- **重连补拉**：连接曾失败后重开即失效整个 workspace 命名空间（invalidateAll 仅在重连时触发，首连不触发），指数退避 1s→30s 上限，close/abort 停止重连（实测不再建连）。
- **队列语义**：consumer 走 Q01 graphile-worker（重试/信号遵守），真实 outbox 行经 worker 投递到在线订阅者实测；多订阅者（无状态扇出）均收到同一事件。

## 明确边界

多节点广播的跨进程扇出属 B03（本 hub 为进程内）；通知收件箱消费与已读状态属 N03；事件频道不承载正文同步（页面文档走 Hocuspocus）也不重放历史（无游标，靠补拉）。前端组件接线（provider 挂载进应用壳）随 U02。
