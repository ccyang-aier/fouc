# B04 · Web y-indexeddb 文档生命周期

日期：2026-09-26。模块：前端 `src/features/knowledge/collaboration/`（`page-provider.ts` 连接编排、`page-sync-state.ts` 纯状态机、`offline-doc.ts` y-indexeddb 生命周期）+ 共享命名源 `shared/src/knowledge/collaboration/page-documents.ts`（`pageDocumentName`/`parsePageDocument` 纯函数，与 shared/src/knowledge/collaboration/page-documents.ts 语义一致，后端后续切换复用）+ 根依赖（`@hocuspocus/provider@4.7.0`、`yjs@13.6.33`、`y-protocols`、`y-indexeddb@9.0.12`；dev：`fake-indexeddb`、`lib0`）。

```powershell
bun test src/features/knowledge/collaboration   # 21 pass / 0 fail（本任务新增 17，B06 回归 4）
pnpm typecheck                                   # 全绿（本任务文件零错误）
pnpm shared:typecheck                            # 全绿
pnpm exec eslint --max-warnings=0 src/features/knowledge/collaboration                       # 0 问题
pnpm exec eslint --no-ignore --max-warnings=0 shared/src/knowledge/collaboration             # 0 问题（shared 在全局 ignore 列表，须 --no-ignore）
node scripts/verify-knowledge-boundaries.mjs     # 222 文件，无反向依赖
bun test src/features/knowledge                 # 204 pass / 0 fail（无跨模块回归）
bun test shared/src/knowledge                   # 186 pass / 0 fail
```

## 真实栈 smoke（一次性脚本，不入库）

`bun %TEMP%\b04-smoke.ts` 以真实 Bun 监听器（B01 升级门 + A03 认证器 + 一次性 RLS 租户库）+ 真实 TCP WebSocket（Cookie 经 WebSocketPolyfill 注入，模拟浏览器握手自动携带）+ 真实 B02 doc_state（防抖 300ms）驱动本模块，全部通过：

- 死网络开局 → session 落 `offline`，离线编辑 `cloudPending=true` 可见；
- 网络恢复 → 真实重连与握手 → `synced`，state vector 交换把离线编辑上传；
- 防抖后 Postgres doc_state 同时持久化离线编辑与在线编辑（解码验证）；
- destroy 后离线重开 → IndexedDB 副本完整恢复合并后的正文（`"live smoke edit • offline smoke edit"`）；
- 全程无后台数据库错误，一次性租户库自动回收。

## 通过的实际流程（逐条对应验收标准）

- **离线先加载本地 Y.Doc 可编辑**：session 先开 `openOfflinePageDocument`（IndexedDB 数据库名即共享文档名），`whenLoaded`（含 2s 兜底超时，防存储 wedged 卡死云连接）落地 `localReady` 后才创建 provider；测试实测服务端静默时正文先从本地副本渲染、编辑进入本地（fake-indexeddb 上跑真实 IndexeddbPersistence）；后端不可达时 provider 重试环进 `offline`，编辑继续、`cloudPending` 可见；浏览器存储不可用时构造被捕获，降级为内存 + 云（不阻塞编辑）。
- **state vector 交换后收敛**：测试用最小协议服务端（lib0 组帧 + y-protocols 同步，回 SyncStep2 后跟随自身 SyncStep1，即真实服务器的 SV 交换形态；鉴权应答对齐 B01）驱动真实 @hocuspocus/provider：断线期间双端各自编辑（客户端 offline edit ×2、服务端 cloud edit），重连后两侧文本逐字相等（上传 + 下载双向）；在线期间双向实时更新（UpdateMessage 广播）。真实栈 smoke 见上。
- **切页清理 provider/监听**：`destroy()`（幂等，AbortSignal 触发同路径）依次 `provider.destroy()`（摘 socket 监听、关连接）→ `offline.destroy()`（摘 doc update 监听、关库）→ `doc.destroy()`；实测 socket 关闭且由客户端发起、Y.Doc 观察者表清空（provider/persistence/状态分发三类监听全部拆除）、服务端后续广播无送达、无新建连接；同页重开 session 从 IndexedDB 恢复后再收敛。
- **状态区分本地保存与云同步**：`PageDocumentStatus = { phase: local-only|syncing|synced|offline|error, localReady, cloudPending, errorReason }`，纯 reducer（重复事件返回同一对象引用，适配 useSyncExternalStore）；本地保存 = IndexedDB 逐更新事务落盘（`localReady` 标记副本已加载）；未同步变更 = 非 synced 阶段的本地交易置 `cloudPending`，握手确认清除；鉴权失败为终态 `error` 并 `provider.disconnect()` 停止重试环（本地文档保留供 UI 展示直至离页）。

## 关键决策

- 文档名唯一源移入 shared（纯函数、zod 校验与后端逐字一致）；前端测试按 page-documents.ts 实现语义写死字面量对拍（`page:<uuid>:<uuid>`、畸形名全部拒绝），不 import backend，边界不反转。
- provider URL = U01 origin 直接推导 `ws(s)://<origin>/`（监听器对非 events 升级一律路由到 Hocuspocus，见 page-collaboration-bun.ts），与 B06 `knowledgeEventsUrl` 同构。
- `cloudPending` 语义为"会话内未获服务器确认的本地编辑"（local-only/offline/syncing 阶段的编辑）；synced 阶段的编辑走在线通道不再置位——传输为可靠有序连接 + 重连 SV 交换兜底，协议保证收敛。测试中同步完成到上传落地之间为毫秒级交换窗口，以服务端文本断言覆盖。
- 鉴权沿用握手 Cookie（浏览器 WS 自动携带），协议 token 不承载凭证（B01 从握手请求读取）。

## 明确边界

- 浏览器实机（真实 Chrome/Safari IndexedDB、跨站 Cookie/SameSite 行为、Next 静态导出打包）未验证——dev 下 localhost:3000 → 127.0.0.1:8710 为跨站，SameSite Cookie 是否随 WS 握手发送取决于装配（同源反代或 Cookie 策略），属 Z03；E03 编辑器容器消费本模块状态机接线亦属 E03。未跑 `next build`（会触碰 .next/out，与运行中的 dev 冲突）；模块顶层无浏览器全局访问，仅在构造期使用。
- provider 配置对象因上游类型把 websocket 级选项（WebSocketPolyfill/delay 等）排除在联合类型外而整体断言（`as never`，与 B01 协议测试客户端同法），回调参数显式标注导出的参数类型。
- fake-indexeddb 使 bun 测试可跑真实 IndexeddbPersistence；smoke 脚本位于 %TEMP%（不入库、未改 backend），其中双 yjs 实例警告仅为脚本内根/后端各一份 yjs 的提示，产品前端只打包一份。
