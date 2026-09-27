# N02 验收 — CRDT 评论锚点与侧栏

日期:2026-09-27 · 验收人:主会话 · 实现代理:N02 子代理(三任接续)· 装配:主会话

## 验收命令与结果

```
bun test src/features/knowledge/comments                        # 30 pass / 0 fail(5 文件)
bun test backend/server/src/modules/knowledge/comments                         # 7 pass / 0 fail(真实 RLS 租户库)
bun test backend/server/src/modules/knowledge/api/comment-routes.test.ts       # 4 pass / 0 fail(真实 HTTP 边界)
bun test src/features/knowledge/editor                          # 104 pass(装配后全树回归)
cd backend && bunx tsc --noEmit; bunx tsc --noEmit(根)          # N02 文件 0 错误
bunx eslint src/features/knowledge/comments ...                 # 干净
```

实活:8711 运行时挂载 `comment` tRPC 过程后 `comment.list` 返回 401(过程存在、会话鉴权生效;挂载前为 NOT_FOUND)。

## 交付内容

**后端**:`comments/create-with-id.ts`(客户端 id 创建、重试幂等)、`api/knowledge/comment-routes.ts`(comment.list/create/reply/resolve/reopen/delete 过程记录,ACL fail-closed 集成验证);N01 服务层既有 access/queries/mutations/notifications(384 行集成测试)。

**共享**:`shared/src/knowledge/comments/` 全套 zod 契约,threadId 客户端生成使 CRDT mark 与持久化线程同 id。

**前端**(src/features/knowledge/comments/ + editor/comments-integration.tsx):comment-anchors(纯 PM 锚点语义,mark `inclusive:false excludes:'' attrs:{threadId}`,与建议标记互不干扰)、comments-plugin(琥珀下划线+计数徽章,resolved/orphan/pending/active/flash 五态)、comments-view-model(按阅读序分组/已解决折叠/孤立锚点可解释)、comments-controller+components(侧栏:分组卡片、回复串、解决/重开、锚点定位跳转、删除、只读矩阵)、comments-api/queries(传输+TanStack Query)、实时链路(comment.changed outbox→B06→comments 键失效→refetch)。

**装配(主会话)**:router.ts 挂 `comment: knowledgeCommentRouterRecord`;editor-surface 挂 `createCommentsEditorExtension()` + `PageCommentsLayer`(评审栏与历史栏同层)。

**附带修复(主会话)**:根 tsconfig target ES2017→ES2020(api-types 的 type-only 后端引用把后端类型图拉入根程序,BigInt 字面量报错;清 tsbuildinfo 缓存后消除);metadata-queue.test.ts 假类型补 path/workspaceId(U04 验收时漏检的 4 处根 tsc 错误)。

## 验收标准核对(CRDT 评论锚点与侧栏)

- 划词评论锚点随 CRDT 稳定:双编辑器并发输入前后锚点不漂、删除传播(测试)✓;与建议标记互斥不干扰 ✓
- 侧栏:分组/回复串/解决态/锚点高亮跳转 ✓;只读矩阵 ✓
- 实时:comment.changed→B06→失效→refetch 链路各环验证 ✓
