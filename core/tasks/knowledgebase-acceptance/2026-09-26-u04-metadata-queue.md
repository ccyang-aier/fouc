# U04 验收 — 本地元数据操作队列

日期:2026-09-26 · 验收人:主会话(单人实现)

## 验收命令与结果

```
bun test src/features/knowledge/collaboration/metadata-queue.test.ts   # 6 pass / 0 fail / 29 断言
bunx eslint --max-warnings=0 src/features/knowledge/collaboration/metadata-queue.ts ...test.ts   # 干净
node scripts/verify-knowledge-boundaries.mjs   # 335 文件通过
```

类型检查:根目录 `tsc --noEmit` 对本任务文件 0 错误(输出中的 y-encoding BigInt/scratch-e04 错误属并行代理文件与根 tsconfig 语境,非本任务引入)。

## 交付内容

`src/features/knowledge/collaboration/metadata-queue.ts`:
- `QueuedMetadataOperation`:{operationId(UUID)、createdAt、request(create/update/move/recycle/restore 的 tRPC 载荷)、treeOperation(U03 乐观代数的孪生记录)}——排队即乐观 apply,拒绝即 `undoTreeOperation` 回滚,职责不重叠。
- `createMetadataQueue`:localStorage 持久化(version 1 序列化,损坏即静默清空);FIFO 严格按序提交;失败分类复用数据层唯一分类器 `isRetryableKnowledgeError`(NETWORK/UNAVAILABLE/RATE_LIMITED 保留待下次 flush,其余丢弃并回调 onRejected);单飞 flush 链防止并发提交;`attach()` 订阅浏览器 online 事件自动续传。
- `createBrowserMetadataQueue`:浏览器绑定(localStorage per workspace / navigator.onLine / crypto.randomUUID)。
- 幂等:enqueue 按 operationId 去重;transient 重试原样重发同一载荷(move 的 operationId、create 的客户端 pageId 保持不变)。

## 验收标准核对

- UUID 操作持久化:测试 1「离线入队 → 新队列实例同 storage 重放(模拟刷新)→ 重连按序提交」✓
- 离线乐观、重连按序提交:测试 1 + 测试 6(离线 flush no-op、online 事件续传)✓
- 循环/无权失败回滚:测试 3(FORBIDDEN → onRejected 携 treeOperation、条目出队、后续操作继续)✓
- 重复重试不重复创建:测试 2(NETWORK 后重发同一 create 载荷)+ 测试 4(重复 operationId 仅入队一次)✓
