# V03 验收 — 历史面板与协作安全恢复

日期:2026-09-27 · 验收人:主会话(单人实现)

## 验收命令与结果

```
bun test backend/server/src/modules/knowledge/collaboration/history.integration.test.ts   # 3 pass / 0 fail / 11 断言
bun test src/features/knowledge/history                                    # 8 pass / 0 fail / 20 断言(2 文件)
bun test backend/server/src/modules/knowledge/collaboration/checkpoints.integration.test.ts + collaboration.integration.test.ts  # 12 pass(回归)
bun test backend/server/src/modules/knowledge/permissions + organization                  # 57 pass(回归,fixture 扩展)
bun test src/features/knowledge/editor                                     # 104 pass(装配后全树回归)
bunx tsc --noEmit(backend + 根)/eslint --max-warnings=0 history            # 0 错误/干净
node scripts/verify-knowledge-boundaries.mjs                               # 375 文件通过
```

## 交付内容

**后端**:
- `collaboration/history.ts`:listPageCheckpoints(新→旧,200 条上限)、readPageCheckpoint(Y 状态→PM JSON 预览,不可解码报 CHECKPOINT_UNREADABLE,状态 blob 不出服务端)。
- `api/knowledge/checkpoint-routes.ts`:GET 列表/预览(view)、POST 命名(edit);P03 单一 ACL 入口逐请求授权;requireFoucIdentity 会话;跨租户 403 无存在性泄露。
- checkpoint 扩展装配:pageCollaborationConfiguration/createPageCollaborationListener 增可选 checkpoints 参数(runtime 以 collab 角色挂载);permissions-test-fixture 增 mount 扩展点。

**前端**(src/features/knowledge/history/):
- `history-api.ts`:会话路由客户端(结构化错误映射 FORBIDDEN/NOT_FOUND/UNAVAILABLE)。
- `restore.ts`:checkpointBodyToNode(编辑器 schema 校验)、buildRestoreTransaction(单 replaceWith 步=单 Y 事务)、renderCheckpointHtml(DOMSerializer 只读预览,经编辑器 schema)。
- `history-panel.tsx`:版本列表(标签/时间/作者)、命名当前版本、预览渲染、恢复按钮(需 edit;恢复后提示可 Ctrl+Z 撤销);装配于 editor-surface 右栏(工具栏 ClockCounterClockwise 按钮开关)。

## 验收标准核对(预览版本、作者、命名;恢复通过新 Y.Doc 事务且可撤销;另一在线编辑者不中断)

- 预览/作者/命名:集成测试断言标签、作者集合(WS 连接上下文归因)、PM JSON 预览 ✓;UI 渲染经组件+API 测试 ✓
- 恢复语义:恢复为**客户端在活动编辑器上的单个 ProseMirror 事务**(y-prosemirror 自动映射为单 Y 事务→B08 本连接可撤销;其他编辑者收到普通远端更新)。集成测试:恢复者单事务替换正文 → 第二编辑者收到且继续追加编辑不中断 ✓
- ACL:viewer 可读不可命名(403)、跨租户 403 ✓
