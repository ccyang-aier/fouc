# V01 · 自动、结束会话与手动检查点

日期：2026-09-26。模块：`backend/src/knowledge/collaboration/checkpoints.ts`（策略 + 自包含 Hocuspocus Extension）+ `checkpoints.integration.test.ts`（真实 Bun 监听器 + 真实 PG）。

`doc_checkpoint` 沿用现有 schema（workspaceId/id/pageId/state/stateVector/authors uuid[]/label varchar(200)/createdAt），无需 schema 变更。Extension 通过 `onChange` 聚合作者、`afterStoreDocument`（在 B02 doc_state 提交之后）评估自动检查点、`beforeUnloadDocument`（最后连接断开、最终落库已冲刷后）写会话结束检查点；手动命名版本是 Extension 上的显式方法。阈值 `CHECKPOINT_INTERVAL_MS = 10 分钟`，可经 `PageCheckpointPolicy { intervalMs, now }` 注入。

```bash
cd C:/AIWorks/26Coding/fouc
bun test backend/src/knowledge/collaboration/checkpoints          # 6 pass / 0 fail（另与 B02 4 项合跑 10 pass / 0 fail，共三连绿）
pnpm backend:typecheck                                             # 零错误
pnpm exec eslint --no-ignore backend/src/knowledge/collaboration/checkpoints.ts        # 无发现
pnpm exec eslint --no-ignore backend/src/knowledge/collaboration/checkpoints.integration.test.ts  # 无发现
```

装配方式（测试即示例；生产合并待主线程，见下）：`pageCollaborationConfiguration(...)` 的返回值上追加 `extensions: [...(config.extensions ?? []), pageCheckpointExtension({ pool }, { intervalMs })]` 后交给 `new Hocuspocus(...)`，B02 钩子零改动。

## 逐条验收标准的实际观察

1. **自动检查点**（intervalMs=700 加速）：阈值内首次编辑落 doc_state 但 `doc_checkpoint` 为空；跨过阈值后**无编辑的 800ms 空闲不写**（无定时器，评估只发生在真实存储时机）；再次编辑 → 1 行，authors=[写者 userId]，label 为 NULL，解码快照含两段正文。写后断开无新增行。
2. **结束会话检查点**（intervalMs=60_000 等效关闭自动路径）：编辑落库后断开 → 1 行（label NULL、authors 正确、正文还原）；重连不动编辑再断开 → 仍 1 行（无未检查点变更不写）；从未编辑的页面反复连接断开 → 0 行。beforeUnloadDocument 在 Hocuspocus 最终 store 冲刷之后执行，快照永不领先 doc_state。
3. **手动命名版本**：`createNamedCheckpoint(scope, label)`。状态有变 → `created`（新行含 label）；状态与最新检查点一致 → `labeled`（把 label 附到既有快照、不复制全量状态，同 ID 返回，重复调用收敛为单行，改名同 ID 覆盖）；文档未加载 → 以已提交 doc_state 为权威判定 created/labeled。label 去除首尾空白后必须非空且 ≤200 字符，违例抛 `CheckpointLabelError { reason: 'empty' | 'too_long' }`（实测 201 字符与空白串）。
4. **作者集合**：两个真实会话 Cookie 连接（reader/owner 各自编辑）断开后，authors 聚合为两人 userId（与最后编辑者无关）。server-internal 写入（DirectConnection 无上下文）如实处理：状态照常被卸载检查点保存，authors 为空数组，绝不伪造。
5. **GC 保持开启**：装配沿用 B02 的 `yDocOptions.gc: true`（实测配置断言）；快照由 GC 后的活文档 `encodeStateAsUpdate` 编码 —— 插入 'erased' 后删除、再插入 'kept'，检查点字节中不含 'erased'（latin1 全文搜索）、解码正文仅为 'kept'，删除内容不会借检查点复活。恢复流程属 V03。

## 关键决策与边界

- **评估时机**：自动路径挂在防抖存储钩子（store 必然意味着真实编辑），不设定时器 —— 空闲文档零写入；"距上一检查点超阈值"在编辑到达时评估，慢钟最迟在该次编辑时补上。区间锚点在文档加载时从 DB 最新检查点恢复，跨重启不重置 10 分钟时钟。
- **并发**：每文档一条 promise 链串行化自动/卸载/手动写入；写失败时跟踪状态不前移（Hocuspocus 保留内存文档的重试契约不受影响）。
- **多节点**：Redis 中继的更新跳过 store 钩子（上游行为），其变更由下一次本节点存储/卸载的 state-vector 比对捕获，但跨节点作者归属不补录 —— 属 B03 边界。
- **发现的主线待合并项**：① `page-collaboration-server.ts` 装配处将本 Extension 加入 extensions（一行）；② B02 已提交代码 `page-collaboration-server.ts:58` `data.lastContext?.authority.actor` 对 `{}` 形态的 lastContext（server-internal 写入）会 TypeError（`?.` 短链不覆盖后续 `.actor`），应为 `data.lastContext?.authority?.actor` —— server-internal 写入的 doc_state 落库因此中断（Hocuspocus 已兜底保内存），本任务测试暴露该路径，文件在并行代理工作集内未动。
