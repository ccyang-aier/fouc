# E05 · 表格、分栏和 Callout NodeView — 验收记录

- 日期：2026-09-27
- 结论：**通过**
- 交付物：`src/features/knowledge/editor/blocks/`（callout-node-view.tsx、columns-node-view.tsx、table-node-view.tsx、table-commands.ts、index.ts、table-commands.test.ts、blocks.instance.test.ts）

## 验收命令（本人执行）

```bash
bun test src/features/knowledge/editor/blocks/table-commands.test.ts src/features/knowledge/editor/blocks/blocks.instance.test.ts
# 31 pass / 0 fail, 229 expect() calls
bunx tsc --noEmit --incremental false
# 0 errors（整仓干净）
bunx eslint src/features/knowledge/editor/blocks
# clean
```

## 验收标准核对

- **嵌套编辑/增删/拖拽/键盘不损坏 blockId**：blocks.instance.test.ts 在真实 Tiptap Editor（happy-dom + React root，NodeView 真实 DOM）中执行 Enter 拆分、Backspace 合并、容器解包、moveBlockDown、表格行列增删后遍历文档断言每个 foucBlock 节点均有合法 blockId；`reidentifyPastedSlice` 跨页粘贴副本对嵌套 callout+table 产生 8 个全新区分的 blockId。
- **表格编辑**：无 prosemirror-tables 依赖，纯 PM 事务实现 addRow/addColumn（跨行对齐，colspan 感知列索引）/toggleHeaderRow（内容与 align 保留）/deleteRow/deleteColumn（末行末列删除整个表格，schema 禁止空表）/deleteTable；浮动工具栏 8 个操作（悬停或光标在表内出现），hover 激活时先把光标定位到首单元格保证命令上下文。
- **分栏自适应**：flex 布局 + `[&>*]:min-w-[300px]:flex-1:basis-0` 纯 CSS 换行收窄；width 属性原样保留（Markdown 往返不丢）。
- **callout 风格精致**：tone（neutral/info/warn/success/danger，未知回退 neutral）色彩 color-mix 洗涤 + 3px 左缘色条 + emoji chip（24 emoji 网格 + 5 tone 色板弹层，外点/Esc 关闭，焦点归还）。
- **共享 schema 一致**：`getSchema(applyBlockNodeViews(createKnowledgeExtensions()))` 与 `knowledgeSchema` 节点规格逐项相同 —— NodeView 通过 withNodeView 替换扩展实例挂接，schema 零改动。

## 事实与权衡

- NodeView DOM 重新输出 data-fouc-node/data-emoji 等语义属性（registry 将所有 attr 标记 rendered:false，Tiptap HTMLAttributes 为空），剪贴板序列化仍走 schema 驱动不受影响。
- 实例测试需要 React root（ReactNodeViewRenderer 依赖 editor.contentComponent），以 createRoot+EditorContent 挂载并 settle。
- 发现并修复两处 tableNodeAt 定位缺陷（$pos.index 层级差一、根子节点起始位置为 0），由纯命令测试逼出。
