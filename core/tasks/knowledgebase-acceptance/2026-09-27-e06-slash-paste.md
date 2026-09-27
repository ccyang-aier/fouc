# E06 · Slash 菜单与 Markdown/HTML 粘贴 — 验收记录

- 日期：2026-09-27
- 结论：**通过**
- 交付物：`src/features/knowledge/editor/commands/`（slash-items.ts、markdown-detect.ts、slash-paste.ts、slash-menu.tsx、index.ts 及三个测试文件）

## 验收命令（本人执行）

```bash
bun test src/features/knowledge/editor/commands/
# 48 pass / 0 fail, 184 expect() calls（3 个文件）
bunx tsc --noEmit --incremental false
# 0 errors（整仓干净）
bunx eslint src/features/knowledge/editor/commands
# clean
```

## 验收标准核对

- **菜单由注册表生成**：`buildSlashItems(registry)` 从共享 BlockRegistry 的 `slash` 元数据生成全部条目（slash-items.test.ts 断言与注册表定义一一对应），插入命令经可扩展 `INSERT_COMMANDS` 记录 + `registerSlashInsert`（J05 `/ai` 等后续入口免改内核）。每个条目的 run 在真实 Editor 实例上逐一验证成功且产生正确节点类型（含原子块 21 种）。
- **检索**：标题/关键词不区分大小写匹配，startsWith > includes > keyword 排序（26 项检测矩阵 + 排序用例）。
- **方向键/回车/Esc**：PM 插件内 handleKeyDown 拦截（打开状态下 ArrowUp/Down 循环、Enter 执行、Esc 关闭，全部 preventDefault）；实例测试覆盖输入 `/` 打开、`表格` 过滤、Enter 插入并移除触发文本、Esc 防御、光标移出关闭。
- **Markdown/HTML/纯文本识别**：内部剪贴板标记（data-fouc-*）走默认路径（E02 blockId 重标识不回归）；text/html 经分离文档 DOMParser + PM DOMParser.fromSchema 安全解析插入；text/plain 经 detectPasteKind 启发式（标题/列表/围栏/GFM 表格/强调标记），Markdown 走 M01 管线（惰性绑定编辑器 schema）转块插入，管线失败回退纯文本。
- **不执行不安全 HTML**：实例测试注入 `<script>alert(1)</script>`、`<img src=x onerror=alert(1)>`、`<a href="javascript:...">` —— 脚本不产生节点、事件属性被剥离、危险协议经 safeKnowledgeUrl 清洗；从不将剪贴板 HTML 写入 innerHTML。

## 事实与权衡

- 朴素 `tr.replaceSelection(new Slice(doc.content,0,0))` 在光标处会静默丢块/内联化（实验证实）—— 改用空文本块替换/块首上插/其余位置自动提升的调整式 replaceWith，三种光标位置均有测试。
- 触发删除与插入为两次 dispatch（undo 两步）—— 接受的简化，已记录。
- 菜单 UI：portal 悬浮、coordsAtPos 定位 + 视口钳制 + 底部翻转、分组中文标题、accent 高亮 + 左缘条、ARIA menu/activedescendant、140ms motion、无匹配空态、blur 关闭（指针在菜单内除外）。
