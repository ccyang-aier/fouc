# H01 · 块索引增量投影

日期：2026-09-26。模块：`backend/server/src/modules/knowledge/search/indexer.ts`（新增）+ `indexer.integration.test.ts`（新增）。前置：M02 AI 方言锚点、B02 doc.changed outbox、P02 `withPermissionIndexWrite`、Q01 graphile-worker 消费者模式、L01 backlinks 消费者、E01/E02 块注册表与 blockId 修复。schema 变更：`database/knowledge/schema/content.ts` 的 `block_index` 按任务约定补列 `title_path text`（可空，短块的检索呈现上下文），`current.sql` 已重生成并通过 `--check`。

以真实邮箱身份、真实 graphile-worker 队列（同事件并行调度 backlinks + index 两个消费者）、普通 RLS 角色租户事务、一次性 disposable 数据库验证：

```bash
bun test backend/server/src/modules/knowledge/search            # 13 pass / 0 fail / 105 expect（含 L01 回归 6 项），三轮复跑稳定
pnpm backend:typecheck                           # 0 错误
pnpm exec eslint --no-ignore backend/server/src/modules/knowledge/search   # 无告警
bun backend/server/scripts/database-schema.ts --check  # Knowledge current SQL matches the Drizzle source
```

## 管线与关键决策

- **Y.Doc → ProseMirror（后端零编辑器依赖）**：后端 pnpm 严格依赖域不可直接 import `y-prosemirror`/`@tiptap/pm`，但 `@fouc/shared/knowledge/{schema,markdown}` 自身可用。indexer 按 y-prosemirror 的存储编码忠实解码：`Y.XmlElement.nodeName/attributes` = 节点类型/属性，`Y.XmlText` delta 属性 = 文本 mark（可自重叠 mark 以 `名--哈希` 存储，解码取 `--` 前名，与 `ySyncPlugin` 的 `marksToAttributes/yattr2markname` 同规则）。`createChecked` 保证 schema 不合法正文直接失败（走消费者重试语义，同 L01 损坏 doc.state 路径，已测 `notABlock` 拒绝）。Fragment.fromArray 对相邻同 markup 文本节点的合并保证与编辑器视图等价。
- **每块索引文本 = M02 `createAiContext().read()` 切片**：权威载体 Markdown（含 `{#b:id}` 锚点与媒体派生文本位）即规范化内容；`contentHash = sha256(切片.trim())`（64 位 hex，满足表 check）。mark（粗体、链接）、媒体 alt、代码等经 AI 方言如实进入 contentMd（已测 `**…**` 与 alt 文本）。
- **skip 容器不落行**：注册表 `index.mode==='skip'` 的 bulletList/orderedList/taskList/table/tableRow/columns/column/horizontalRule/blockReference/databaseView 不产生行——其内容即子块，容器再落行即"重"；`text`/`media` 块（含 listItem、tableCell/Header、callout、blockquote、aiBlock、image/video/audio/file 等容器子块递归）逐一落行，保证"不漏不重"。验收观测：嵌套正文 8 行 + skip 1；两行表格 8 行（4 单元格 + 4 段落）+ skip 3（table/tableRow×2）。
- **短块标题路径（新列 `title_path`）**：AI Markdown ≤ 120 字符的块记录 `页面标题路径 + 前序标题链`（如 `落地页 > 季度目标 > 子目标`）。标题是 textblock，不可能成为结构祖先（§4.1 嵌套容器均非标题），故按文档顺序维护"最近前序标题"的大纲栈（heading level 出栈规则同标准 outline）。长块为 NULL；标题路径不参与 contentHash（改标题不制造内容差量），但进入差量比较列，正文变化时随重投影刷新。

## 通过的实际流程（逐条对应验收标准）

- **遍历嵌套块**：heading/粗体长段/math/image/callout(heading+bulletList(listItem(paragraph))) 正文 → 恰 8 行且 blockType 一一正确；两行 GFM 表格 → 单元格与其内段落全部落行、table/tableRow 不落行；Y 编码的 mark 经 AI 方言保留（`**长文**`）。
- **hash 差量增改删**：4 块正文首次 `{inserted:4}`；改一块 + 删一块后 `{updated:1, deleted:1}`，且未变块的物理行 id 不变（证明无删除重插循环），变更块同行更新、hash 变化；删除 doc_state 权威行后 `{deleted:3}` 清空投影。
- **修复 ID**：正文含"缺 blockId 的链接承载段 + 后出现的重复 `dup` + 非法 `bad id!`"，经真实队列消费后：block_index 4 行 ID 全部合法唯一（`dup` 保留首次出现，E02 规则）、doc_state 解码出的权威 ID 同样修复、随后直接重投影返回全零（权威状态已修复，不再产生写）。
- **更新 backlink**：见下节协同机制；测试断言反链行 `srcBlockId` = 修复后的承载块 ID（无论两消费者先后完成）。
- **重跑幂等**：同一（合法）正文以新 Yjs 编码再次入队消费，行集（含物理 row id、hash、titlePath、principals）逐字节不变；同状态直接重算返回 `{inserted:0, updated:0, deleted:0, repaired:0, skipped:0}`，差量为空时不进入写路径（无任何 block_index DML）。
- **短块带标题路径**：`落地页 > 季度目标 > 子目标`（列表项）、`落地页 > 季度目标`（callout/math）、`落地页`（顶级标题自身）、长段为 NULL。
- **权限投影同步**：私有 teamspace（defaultAccess:null）授权 reader edit 并物化后索引 → 行 principals=`[user:reader]`（`withPermissionIndexWrite` 锁下取的投影），reader 经 `indexedBlockAccessCondition` 可见 1 块；替换 ACL 为 owner full 并消费 acl.changed 后，既有行被 P02 重建路径同步为 `[user:owner]`，reader 可见 0 块。

## 与 L01 的并发协同（doc.changed 双消费者）

Q01 的 dispatch 为同一事件给每个消费者各入队一个 job（`knowledge.consume.update_backlinks` / `knowledge.consume.index_page_blocks`），worker concurrency 下可并行。串行化与收敛机制：

- 两个消费者的事务第一步都 `SELECT … FROM doc_state … FOR UPDATE`（L01 模式），同页并发互相等待，后到者读到先到者已提交的权威状态；无其他锁交叉（indexer 之后才取 P02 的 workspace→teamspace→page 锁，任何路径都不存在"权限锁→doc_state 锁"的反序，无死锁环）。
- backlinks 与 block index 都是"以 doc_state 为唯一权威的整页幂等重算"，任意顺序执行结果恒等。
- **读偏闭包**：唯一的不确定窗口是 backlinks 先读到了"修复前"状态（缺 ID 的承载块被 L01 规则丢弃）。indexer 在本事务内修复了权威状态时，会再调一次 `refreshPageBacklinks`，使最终反链必然反映修复后 ID；若 backlinks 在 indexer 之后运行，则它本就读到修复后状态，重算幂等。两种交错均已由测试覆盖（断言最终行集而非执行顺序）。

## 实现要点

- **修复回写经权威路径**：`planBlockIdRepairs`（shared E02 服务端修复函数，与 `repairBlockIds` 同一规则）给出位置级修复计划；按位置映射回 `Y.XmlElement` 以 `setAttribute` 落回——正是编辑器 `setNodeMarkup` 经 `updateYFragment` 会产生的 Y 变更，可与并发编辑 CRDT 合并。随后以与 `onStoreDocument` 相同的形状（state+stateVector 同事务 upsert）写回 doc_state，并从修复后的 Y 树重建投影，保证索引与权威状态一致。
- **短投影事务**（P02 端口）：解析/修复/AI Markdown 全部在进入 `withPermissionIndexWrite` 之前完成；回调内只做差量 DML，插入行携带锁下读取的 principals/aclRevision。差量为空时跳过端口调用（零 block_index 写）；有写则必然经端口（锁 + 全页 principals 同步兜底，P02 语义）。同事务持有 doc_state 行锁到提交。
- **批量插入** 250 行/批（沿用 rebuild.ts 批式）；删除走 `inArray` 精确清单；`onConflictDoNothing` 兜底唯一约束。
- 消费者命名 `index_page_blocks`（队列任务 `knowledge.consume.index_page_blocks`），未改动已提交的 `search/index.ts` 与 `backlinks.ts`（仅 import）。

## 明确边界

- **修复与在线会话**：修复写入 doc_state（唯一权威），但活跃 Hocuspocus 会话内存中的文档不感知；该会话若随后再次 onStoreDocument，可能以未修复状态覆盖（仅丢修复 ID，不丢内容），下一次 doc.changed 会重新修复收敛。理想闭环（把修复作为 Y update 推入在线文档）需要协作服务器实例接线，超出本任务范围。
- **修复不发 doc.changed**：B02 约定 actor 不得伪造，服务端内部写入不携带事件；反链的即时一致性由 indexer 在修复事务内自查保证（见协同节）。
- **标题路径的陈旧窗口**：页标题/页面移动不触发 doc.changed，`title_path` 到该页下一次正文变化才刷新（ACL 无此问题，由 P02 事件驱动同步）。BM25/向量化（H02/H03）检索时以本列做呈现上下文；H02 组合 titlePath+contentMd 作为嵌入上下文。
- **回收页**：软回收页不再有 doc.changed，其行保留但 principals 为空/被 P02 同步清空，且 H03 谓词 join page 已过滤（L01 同策略）；硬删除由 FK cascade 清行。
- **权限物化 pending**：索引时若 ACL 物化尚未就绪（crash 后未重放），行以空 principals 落库（fail-closed），待 acl.changed 重建后同步——不放大权限。
- **消费者接线**：与 `rebuild_permissions`/`update_backlinks` 相同，`index_page_blocks` 在测试内经 `startKnowledgeWorker` 注册验证，常驻运行时组合根接线属后续任务。
- 大页（万级块）一次性删除的 `inArray` 参数量在 PG 参数上限内；如未来超限可分批，当前无真实需求。
