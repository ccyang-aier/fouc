# B01 · Hocuspocus v4 鉴权与只读连接

日期：2026-09-26。模块：`backend/server/src/modules/knowledge/collaboration/`（page-documents/page-collaboration/page-collaboration-server/page-collaboration-bun）。

主代理实现并以真实 Bun 监听器装配 + 官方 @hocuspocus/provider 4.7.0 协议客户端验证：

```powershell
bun test backend/server/src/modules/knowledge/collaboration
pnpm exec eslint --no-ignore backend/server/src/modules/knowledge/collaboration
node scripts/verify-knowledge-boundaries.mjs
```

**6 tests / 0 fail**；定向 lint 零告警；架构边界通过。

## 通过的实际流程（逐条对应验收标准）

- **WS 校验会话/PAT/page scope**：首条协议消息携带严格 `page:<workspaceId>:<pageId>` 文档名；onConnect 钩子用 A03 认证器从握手请求取会话 Cookie 或 PAT Bearer，再开租户事务执行 P03 `authorizePageAccess(view)`。PAT 凭证按 scope 绑定：`read` 令牌即使持 edit 级 ACL 也只读，`read+write` 才可写（实测）。
- **view/comment 连接禁止正文写入**：以 `connectionConfig.readOnly` 交给 Hocuspocus 原生强制——服务端在 messageYjsUpdate/SyncStep2 分支直接丢弃更新并回 syncStatus(false)；实测 view 与 comment 连接 scope=readonly、其写入在 250ms 观察窗内从未出现在任何其他客户端或服务端文档，读同步（SyncStep1/2）正常。
- **GC 开启**：装配显式 `yDocOptions: { gc: true, gcFilter: () => true }`，测试断言配置生效。
- **拒绝未授权文档和 workspace 频道**：匿名、非成员 Cookie、随机不存在页面、围栏重建窗口、他空间成员、`ws:` 频道名与一切畸形文档名统一以同一 `permission-denied` 拒绝——不可用于探测页面存在性。
- **Bun 生产装配**：`createPageCollaborationListener` 用 Bun.serve 原生 WebSocket + crossws Bun 适配器组装，即 Z03 的真实形态。两个平台级适配已内建：fetch 必须返回 `handleUpgrade` 的 Promise（否则升级失效）；Hocuspocus 不能直接持有 Bun ServerWebSocket 引用调用（ERR_INVALID_THIS realm 校验），一律经 peer 路由的 WebSocketLike 适配器。

## 明确边界

不含 Y.Doc 持久化（B02）、多节点广播（B03）、Awareness 语义（B07）、断线期间权限刷新（连接时快照 + P02 围栏，长连接逐操作刷新属后续协作任务）；监听器生命周期由 Z03 装配。测试客户端为官方 provider（协议互通证据），生产 Web 客户端属 B04。
