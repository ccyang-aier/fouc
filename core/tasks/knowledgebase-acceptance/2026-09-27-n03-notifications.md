# N03 验收 — 通知收件箱

日期:2026-09-27 · 验收人:主会话 · 实现代理:N03 子代理(全量实现)· 接线:主会话

## 验收命令与结果

```
bun test backend/server/src/modules/knowledge/notifications     # 11 pass / 0 fail / 77 断言(真实 Postgres)
bun test src/features/knowledge/notifications    # 16 pass / 0 fail / 57 断言
bun test shared/src                              # 186 pass(回归)
bunx tsc --noEmit(backend/根) + eslint           # N03 文件 0 错误
node scripts/verify-knowledge-boundaries.mjs     # 375 文件通过
```

## 交付内容

**后端**(backend/server/src/modules/knowledge/notifications/):service(keyset 分页收件箱、创建时过滤+读时按当前有效 ACL 再过滤——撤权/回收页 fail closed、未读计数、单条已读幂等+他人通知 404 无泄露、全部已读含不可见行防复活)、http(独立 Hono 路由:列表/未读数/单条已读/全部已读,每请求 authenticator 重验会话+成员资格)。主会话已接线 runtime/server.ts。

**契约**(shared/src/knowledge/notifications/):item/list/mark-read 全套 zod,前后端复用。

**前端**(src/features/knowledge/notifications/):API 传输(响应契约复验)、query/变更挂 notifications 键空间(B06 notification.created 自动失效→实时)、模块级桥 store(useSyncExternalStore 消费,不复制 QueryClient/WS)、视图模型(两类文案/相对时间/99+ 截断)、铃铛组件(未读高亮/单条全部已读/点击跳转自动已读/加载错误空三态/离线降级惰性铃铛)。外壳 system-bar 假数据换真实铃铛;知识页一行 bridge 接线。

## 验收标准核对(评论通知收件人权限过滤、已读操作、实时更新与跳转;无重复跨租户消息)

- 权限过滤:创建时+读时双重(fail closed)✓;已读幂等/外键 404 ✓
- 实时:outbox→consumer→hub 精确一次投递 notification.created,徽标与列表经查询失效刷新 ✓;跳转复用工作台选页 ✓
- 跨租户:双向租户隔离断言,无重复消息 ✓
