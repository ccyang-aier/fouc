# L01 · 页面/块链接与反向引用派生

日期：2026-09-26。模块：`backend/src/knowledge/search/`（backlinks.ts + index.ts + backlinks.integration.test.ts）。前置：M02 AI 方言锚点、B02 doc.changed outbox（onStoreDocument 原子提交 state/vector/事件）、T01 页树、P03 授权谓词、Q01 graphile-worker 消费者模式。schema 的 `backlink` 表（唯一约束 nullsNotDistinct、双侧 page FK cascade、block 格式 check）已存在于 `database/knowledge/schema/content.ts`，本任务未改动 schema。

以真实邮箱身份、真实 graphile-worker 队列、普通 RLS 角色租户事务、一次性 disposable 数据库验证：

```bash
bun test backend/src/knowledge/search          # 6 pass / 0 fail / 22 expect，两轮复跑稳定
pnpm exec eslint --no-ignore backend/src/knowledge/search   # 无告警
pnpm backend:typecheck                         # search/ 零错误
bun backend/scripts/database-schema.ts --check             # Knowledge current SQL matches the Drizzle source
```

`pnpm backend:typecheck` 全量输出当时仅剩 `collaboration/agent-awareness.ts(64)` 一处错误：该文件为其他并行任务的同会话未跟踪新文件（两次运行间才出现），与本任务无关；search/ 目录无任何类型错误。未改动 `shared/`，故未运行 `pnpm shared:typecheck`。

## 链接解析策略（设计 §4.6/§7.1 定夺）

- **承载**：正文 = Y.Doc `default` XmlFragment（y-prosemirror 约定）。wiki 链接是 nodeName `wikiLink` 的 XmlElement，属性与 M02/`shared/knowledge/markdown/wiki.ts` 及 `inline.ts` 的节点属性一致（`target` / `targetBlockId`，另加编辑器解析后写入的稳定 `pageId`）。承载块 = 最近的带合法 `blockId` 的祖先块；无承载块的链接不产生反向引用。所有属性先过契约校验（`blockIdSchema`/`entityIdSchema`），损坏锚点降级为页面链接、损坏 pageId 视为缺失、损坏 blockId 丢弃。
- **解析次序**：显式 `pageId` 优先，命中本工作区未回收页即 `linked`；显式 ID 失效（页面已回收、跨工作区）即 `dangling`，**不回退标题**——避免静默改指同标题的另一页。无显式 ID 时按标题在全部未回收页中精确匹配；标题不唯一同样 `dangling`，由编辑器经显式 pageId 消歧（测试证实显式 ID 在歧义标题下仍稳定命中）。
- **块引用**：`[[target#^block]]` 形态 = wikiLink 的 `targetBlockId`，解析后记入 `dstBlockId`；该块是否仍存在由渲染时按来源页定位（L02 范围）。
- **悬链状态**：`ResolvedPageReference` 显式携带 `status: 'dangling'` + 原始 target 文本，悬链不落 `backlink` 表、不参与入链查询。

## 通过的实际流程（逐条对应验收标准）

- **页面链接 / blockReference 解析稳定 ID**：5 链接正文（显式 ID、唯一标题、标题+`#^` 块锚、不存在标题、跨工作区显式 ID）消费后 `backlink` 行恰为 3：显式与标题链接落到目标页 uuid，块引用保留 `dstBlockId='blk_9'`；出链视图对后两者返回 `dangling`。歧义标题（两同名活页）、指向已回收页的显式 ID（标题文本可匹配另一活页也不回退）、指向已回收页的标题链接均保持悬链且零落表。
- **正文变化更新 backlink、重跑幂等**：v1 正文（含同块重复双链）直接重算返回 `{linked:2, dangling:0}` 且重复链收敛为 1 行；v2 正文改链后经消费者整页替换（旧行消失、新行恰为 1）；同状态直接重算两连击与再入队一次事件均返回 `{linked:1, dangling:1}` 且行集不变（删除+插入同事务，唯一约束兜底）。
- **无权限来源不泄漏**：公共 teamspace 来源页 + `defaultAccess:null` 私有 teamspace 来源页同指一目标页。owner（私有根 full 授权）入链见 2 条、reader（仅 workspace:view）仅见公共来源、非成员（principals 空）见 0 条；软回收公共来源页后立即从 reader 视图消失；悬链改写后来源页行集为空——目标存在性无从泄漏。过滤谓词即 P03 的 `effectivePageAccessCondition(view)`（revision 匹配 + fail closed）。
- **消费失败可重试、不阻塞队列**：写入损坏 doc_state + doc.changed。健康页的派生作业先完成（队列未阻塞），损坏页作业以 `consumer_failed` 留队重试（attempts≥1、last_error 非空、job_failed 诊断）；修复权威状态后重试成功、队列清零、行集正确。并发同页重算由 doc_state `FOR UPDATE` 串行化。

## 实现要点

- 消费者遵循仓库既有模式（rebuild.ts/events.ts）：`KnowledgeConsumer` 联合类型 + 内部 topic 守卫（泛型 `KnowledgeConsumer<'doc.changed'>` 在 handle 参数上逆变、无法进注册表）。
- 修复骨架两处类型错误的根因：显式 ID 收集条件写反（`explicitPageId && !target` 排除了应收集的 ID、反而收进 null）；`const resolved` 被重赋值。同时把悬链计数从总数相减改为按 status 统计（同块重复链去重后相减会错计悬链）。
- `refreshPageBacklinks` 以 doc_state 为唯一权威：无行（正文未持久化/页面已删）即清空该页出链；写入按 `(srcBlockId, dstPageId, dstBlockId)` 去重。
- 测试直写 doc_state+outbox 的组合与 `onStoreDocument` 的原子提交逐字段一致（B02 持久化测试已覆盖防抖路径），避免 debounce 计时不稳定。

## 明确边界

- 入链是**写时物化缓存**：目标页改名/回收后，既有 backlink 行要到来源页下次正文变化才重算；出链即时视图 `readPageOutgoingReferences` 则实时反映（改名后标题链立即显示悬链，已测）。目标页本体授权是调用方职责，`readPageBacklinks` 只过滤来源页。
- 消费者尚未接入常驻运行时组合根（与 `rebuild_permissions`、`workspace_events` 同属待接线状态；测试内经 `startKnowledgeWorker` 注册验证）。
- 块引用目标块的存在性校验、锚点漂移定位与反向引用 UI 属 L02；本任务的 `dstBlockId` 只做忠实记录。
