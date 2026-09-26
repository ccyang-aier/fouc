# B03 · Redis 多节点广播

日期：2026-09-26。模块：`backend/src/knowledge/collaboration/page-collaboration-redis.ts`（配置与工厂）+ `page-collaboration-server.ts` / `page-collaboration-bun.ts`（broadcast 接线）+ `multi-node.integration.test.ts`。

选择的官方机制：`@hocuspocus/extension-redis` 4.7.0（hocuspocus 官方横向扩展扩展），非自研 pub/sub。每节点建立 pub/sub 双连接，订阅 `{prefix}:{documentName}`（默认 prefix `fouc`）与私有回复通道 `{prefix}#reply:{identifier}`；本地变更经单事件循环回合合并后发布 SyncStep1（当前 state vector），对端除应答外立即回发自己的 SyncStep1，本端再以 SyncStep2（真实差量）在对端回复通道送达，对端以 redis 事务 origin 应用——内容传播三跳完成，实测双向 16–19ms。依赖补齐：`backend/package.json` 新增直接依赖 `ioredis@5.6.1`（与扩展声明的 `~5.6.1` 同版去重；代码 import 其类型）；Redlock（`@sesamecare-oss/redlock`）是扩展自带内部机制，我方代码不直接引用，不重复声明。

```bash
pnpm --dir backend add ioredis@5.6.1
bun test backend/src/knowledge/collaboration      # 30 pass / 0 fail（7 文件）
pnpm backend:typecheck                             # 全绿
pnpm exec eslint --no-ignore backend/src/knowledge/collaboration   # 0 error 0 warning
```

修复两处收尾问题：`RedisInstance` 是 `RedisClient | Cluster` 联合，`.stream` 仅存在于单机客户端，测试以 `instanceof RedisClient` 运行时收窄；ioredis 的重连事件名是 `'reconnecting'`（携带 delay 参数），不存在 `'reconnect'`，前代理写错导致标志位永不置位、断线测试超时。另清理 `events.ts` 一个未使用导入。

## 通过的实际流程（逐条对应验收标准）

- **两节点并发更新双向亚秒收敛**：两个真实 `createPageCollaborationListener`（不同端口、同一 PG/Redis/文档），官方 HocuspocusProvider 客户端各连其一。node1 写 → node2 收到、node2 写 → node1 收到，实测 **node1→node2 16ms / node2→node1 16ms**（多次运行 16–19ms），远低于 1000ms 阈值。
- **断连重连 state vector 收敛不丢内容**：client A 在 node2 提交 `committed-before-drop` 并等待落库后断开；node2 卸载文档（断言 `hocuspocus.documents` 不再持有，B02 重加载路径也被覆盖）；node1 写入 `written-while-away` 落库；A 重连 node2，经 SyncStep1/SyncStep2 交换收敛为完整并集，无丢失。
- **doc_state 单一落库权威**：双节点 6 轮交错写入（间隔 40ms，跨防抖窗口）后，落库正文与收敛内存态逐字一致；停写 1s 后计数、再等 1.2s 计数不变——redis-origin 更新在 hocuspocus server 的 `shouldSkipStoreHooks` 中直接跳过 store 调度，接收节点不调度 `onStoreDocument`，落库只发生在写者连接所在节点（B02 唯一路径）；每条 `doc.changed` 的 actor 都是真实写者，广播不伪造归属。并发落库竞态由扩展内建 Redlock（`{prefix}:{doc}:lock`，TTL 1000ms，retryCount 0）串行化：抢锁失败抛 `SkipFurtherHooksError` 中止该节点本次落库链，测试运行中真实出现 `[onStoreDocument] Another instance is already storing this document`，数据安全在持锁节点。
- **认证与断线重连**：REDIS_URL（含密码，rediss:// 自动映射 TLS）注入 ioredis password。实测正确密码 `PONG`、错误密码被服务端拒绝 `WRONGPASS invalid username-password pair or user is disabled.`——两节点的 pub/sub 全程经此认证，任何一次 SyncStep1 交换失败都会使前两条验收无法通过。断线以 socket 级 `stream.destroy()` 模拟 TCP 中断/服务重启对订阅者的效果：close → retryStrategy（默认 `times*50` 上限 2000ms）→ `'reconnecting'` → 重连 ready 后 `autoResubscribe` 重放全部 SUBSCRIBE（文档通道 + 回复通道），后续发布照常送达。

## 明确边界

Redis pub/sub 无持久化：断线窗口内的发布会丢失，不存在重放。恢复依赖 Yjs CRDT 语义——窗口后任一端下一次本地变更触发的 SyncStep1/SyncStep2 全量差量交换即补齐（state vector 差分是幂等超集），以及扩展 `afterLoadDocument` 的 `awaitInitialSyncTimeout`（默认 1000ms）阻塞加载并向持文档节点请求状态。测试覆盖“重连后写入”场景；“断线窗口内丢包且之后无任何写入”的极端补齐路径未注入故障验证（需真实重启 Redis 或精确时序注入；共享 WSL Redis 实例不宜扰动，真实服务重启同此原因未执行，仅以 socket 级中断等价模拟）。未配置 Redis Cluster（单端点）；多实例同文档的 awareness 广播由扩展同通道承载，未单列断言。验证期间并行任务在同目录追加 checkpoints/agent-awareness 测试，最终快照 30 测试全绿含其 9 项，B03 自身 4 项及 B01/B02/B06 既有测试零回归。
