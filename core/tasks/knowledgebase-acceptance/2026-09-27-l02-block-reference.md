# L02 · 实时只读块引用 NodeView — 验收记录

- 日期：2026-09-27
- 结论：**通过**
- 交付物：`src/features/knowledge/editor/blocks/block-reference.tsx`、`block-reference-source.ts`（+两测试）、`src/features/knowledge/editor/open-target.ts`（+测试）、后端 `backend/src/knowledge/search/backlinks.ts`（blockReference 收集）+ 集成测试扩展

## 验收命令（本人执行）

```bash
bun test src/features/knowledge/editor/blocks/block-reference.test.ts src/features/knowledge/editor/blocks/block-reference.instance.test.ts src/features/knowledge/editor/open-target.test.ts
# 25 pass / 0 fail, 91 expect() calls
cd backend && bun test src/knowledge/search/backlinks.integration.test.ts
# 8 pass / 0 fail（真实 Postgres，含 blockReference 新用例；此前连续 3 次全绿）
bunx tsc --noEmit --incremental false        # 0 errors
bun run typecheck（backend）                  # clean
bunx eslint <L02 全部文件>                    # clean
```

## 验收标准核对

- **按需加载来源 Y.Doc**：`createBlockReferenceSources` 以 B04 `connectPageDocument` 为默认连接器（离线副本/重连免费获得），按 `workspaceId:pageId` 引用计数共享会话，末位 release 销毁连接；连接失败拒绝全部等待者并清槽重试（测试覆盖并发共享/计数销毁/失败重试）。
- **更改实时反映**：observeDeep 变更路径门控（仅位于目标块内或祖先子列表变动才重转换）+ 150ms 尾节流；实例测试在真实 Editor + React root 中注入源会话，Y 编辑源块后节流冲刷 DOM 更新，删除目标块翻转为「来源块已删除」。
- **点击原文高亮**：live 卡片点击经 `requestOpenPageBlock`（同时 stage 高亮）→ shell 订阅切换页面 → 编辑器 `takeStagedBlockHighlight` + `revealBlockInEditor`（scrollIntoView + 1.2s flash 动画，无选区副作用）；实例测试断言点击载荷与 flash 类落点。
- **无权/删除/循环引用明确状态并释放连接**：状态机 cyclic（pageId===当前页，短路不连接）/unconfigured/loading（含离线副本先行渲染）/denied（auth-failed）/failed/deleted（synced 或 offline 后块缺失）——真值表全覆盖；循环引用用例断言连接器从未被调用；卸载释放句柄有断言。
- **backlink 表补收（设计 §4.6）**：后端 `extractPageBodyReferences` 额外收集块级 blockReference 原子（自身 blockId 为 srcBlockId，属性校验与 wikiLink 同规），经既有 resolve/refresh 管线落表；集成测试：有效引用成行（含 dstBlockId）、悬链 pageId/空 pageId 不落行、非法自身 blockId 跳过。

## 事实与权衡

- y-prosemirror 无单元素转换助手，重转换为整碎片一次（成本已在代码注释记录），以变更路径门控控制频率；依赖源文档由编辑器保证 schema 合法（转换会静默删除非法子树，已注释）。
- Y.XmlElement 继承自 Y.XmlFragment，向上爬取以「无父类型」判界而非 instanceof。
- 邻接 E05 测试共存运行（blocks 目录 51 pass）无相互干扰。
