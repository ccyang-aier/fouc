# M03 验收 — Obsidian 仓库导入导出

日期:2026-09-26 · 验收人:主会话 · 实现代理:M03 子代理(接续前任代理骨架)

## 验收命令与结果

```
bun test backend/src/knowledge/import-export/    # 64 pass / 0 fail / 281 断言(5 文件)
cd backend && bunx tsc --noEmit                  # 除并行代理在写的 ai/streaming 外 0 错误
node scripts/verify-knowledge-boundaries.mjs     # 335 文件通过
```

## 交付内容(backend/src/knowledge/import-export/)

- `vault.ts`:vault 目录树→页面树映射、同名兄弟导出去重(首名保留、后续 ` 2`/` 3`)、`vaultPathsForExport`。
- `frontmatter.ts` / `body.ts`:frontmatter 解析;正文↔Y.Doc 双向翻译,wikilink `[[page]]`/`[[page.md]]` basename 解析、嵌入 `![[asset]]`→`asset:hash`、导出侧容器块先递归子节点再重建(嵌套行内 wiki 链接正确改写为 vault 路径)、video/audio/file 媒体指令 src 往返改写。
- `import.ts` / `export.ts`:多页导入管线(planning 逐项进度/失败事件、附件经 AS01 入湖、Y.Doc 正文落库、幂等重放、越权拒绝需 P03 edit);导出可见性依赖 P02 物化(与生产 worker 同语义按 outbox acl.changed 重建)。
- 新增测试:vault(16)、frontmatter(8)、body(20)、import-export 集成(8,真实 ParadeDB RLS + MinIO,含导出→再导入→再导出的往返不动点)。
- 本轮修复的 4 个真实缺陷:同名兄弟去重失效、basename 不剥 `.md`、导出侧嵌套 wiki 链接从不改写(容器重建短路子遍历)、媒体指令二次导出断裂;另导入逐页失败现在进进度事件。

## 验收标准核对(任务 acceptance:目录/附件/frontmatter/wiki+块链接往返、多页进度与逐项失败)

- 目录树→页面树、多页进度事件(schema 校验)、逐项失败不阻塞健康页 ✓(集成测试)
- 附件收集与 AS01 入湖 ✓;frontmatter 解析 ✓
- wiki 链接与块引用往返:导出→再导入→再导出到达不动点 ✓
- 幂等重放、越权拒绝 ✓
