# B02 · Y.Doc 权威持久化与原子 Outbox

日期：2026-09-26。模块：`backend/src/knowledge/collaboration/page-collaboration-server.ts`（持久化钩子并入统一装配）+ `persistence.integration.test.ts` / `collaboration-test-client.ts`。

主代理实现并验证：doc_state 是正文唯一权威，onLoadDocument 从其加载，onStoreDocument 在一个租户事务里原子写 state + stateVector + `doc.changed` outbox（含 graphile job）。装配显式设置生产防抖 2s / 上限 10s（Hocuspocus debounce/maxDebounce），测试用 120/400ms 加速窗口。

```powershell
bun test backend/src/knowledge/collaboration
pnpm backend:typecheck
pnpm exec eslint --no-ignore backend/src/knowledge/collaboration
node scripts/verify-knowledge-boundaries.mjs
```

**10 tests / 0 fail**（B02 新增 4 项；B01 6 项回归通过）。类型、定向 lint、架构边界（213 文件）全过。

## 通过的实际流程（逐条对应验收标准）

- **从 doc_state 加载**：新页面无行→空文档；已有行→applyUpdate 恢复。重启监听器后新客户端 sync 即拿到已提交正文（实测 'survives restarts'）。
- **2 秒防抖/最长 10 秒落库**：写入 40ms 后查无行（防抖窗内）；落库由窗触发；连续写入每 60ms 重置窗口，仍被 maxDebounce 上限强制落库（实测 w0..w5 前缀齐全）。生产值为 2s/10s，装配显式声明。
- **state/vector/outbox 同事务**：state、stateVector 与 doc.changed 事件（actor 取触达连接的 authority.actor，human userId 实测匹配写者）在一个 withKnowledgeTenant 事务提交；事件经 appendKnowledgeOutbox 与 graphile job 同原子。无连接上下文的服务端内部写入只持久化正文、不伪造 actor 事件。
- **崩溃重连内容不丢**：已提交状态重启后完整恢复；未落库窗口内的更新由 y-protocols 状态向量交换在重连时补齐（readOnly 写入被服务端丢弃，不产生行/事件）。

## 明确边界

检查点（V01）、Redis 多节点广播（B03）、断线重连的权限刷新（围栏语义见 P02/B01）与 Web/桌面离线副本（B04/B05）不在本任务。onStoreDocument 失败时 Hocuspocus 保留内存文档并在下次变更重试（未注入故障路径，边界如实记录）。
