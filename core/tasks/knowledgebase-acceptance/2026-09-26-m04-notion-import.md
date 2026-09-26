# M04 验收 — Notion 导出导入

日期:2026-09-26 · 验收人:主会话 · 实现代理:M04 子代理

## 验收命令与结果

```
bun test backend/src/knowledge/import-export/notion-html.test.ts
# 12 pass / 0 fail(修复前 8 pass / 4 fail)
```

同目录全量 `bun test backend/src/knowledge/import-export/` 为 59 pass / 3 fail,3 个失败均属并行进行中的 M03(Obsidian)测试,非 M04 范围;notion-* 文件 0 失败。

## 交付内容(backend/src/knowledge/import-export/)

- `notion-html.ts` / `notion-body.ts` / `notion-csv.ts` / `notion-document.ts` / `notion-archive.ts` / `notion-importer.ts` / `notion-types.ts`:Notion HTML 导出包导入全链路——Export-<id> 外壳目录、两遍父归属、同名视图去重告警、wikilink/asset:/断链三类链接映射(断链保留原址+告警,无静默丢失)、CSV 与 HTML 双路径的 database 视图列类型推断、附件经 AS01 presigned 上传。
- 本轮修复 4 个失败:① figure.quote 分支改用 `mixed()` 聚行内片段(裸文本引用体不再产空 blockquote);② node-html-parser v9 解析配置移除 `pre` 的 blockTextElements 整体吞并,`<figure class="code">` 内 `<code class="language-x">` 正确成元素;③ multiSelect 推断新增"单单元格按 `, ` 拆出 ≥2 非空值"信号;④ 测试断言下钻到 `tableCell > paragraph > text`(E01 schema 规定 tableCell content: 'block+',段落无 marks,原断言在任何实现下均不可满足)。

## 验收标准核对

- HTML/Markdown/CSV 导入:HTML(notion-html)、Markdown(importer 走 M01 pipeline.parse)、CSV(notion-csv,含 person/relation 退化告警)✓
- 目录与附件真实样本:notion-archive 外壳/父归属 + AS01 presigned 附件 ✓
- 页面链接正确映射、无静默丢失:notion-body 三类映射 + 断链原址保留 + 结构化告警 ✓
- 导出方向不在 M04 范围(设计文档 §4.4 仅要求导入 Notion 导出内容;notion-types.ts 头注记录该决策)

## 范围外发现(记录,不阻塞)

- `importNotionExport` 尚未接线到 import.ts/API(API 接线属 M05+/导入入口任务)。
