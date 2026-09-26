# B05 · 桌面 SQLite 离线 Yjs 副本

日期：2026-09-26。模块：`backend/src/store/knowledge-documents.ts`（副本接口 + bun:sqlite 实现 + db.ts 新表 knowledge_page_document）、`backend/src/knowledge/collaboration/page-collaboration-desktop.ts`（桌面装配）、两套测试。

主代理实现并验证：桌面 sidecar 运行与生产同一 Hocuspocus 内核的本地页面协作装配，持久化后端换为 SQLite 副本；云端 Postgres doc_state（B02）仍是正文唯一权威，副本只是本地缓存/离线缓冲，重连经 state vector 交换 CRDT 合并收敛、绝不覆盖。

```powershell
bun test backend/src/store/knowledge-documents.test.ts backend/src/knowledge/collaboration/desktop-persistence.integration.test.ts
pnpm exec eslint --no-ignore backend/src/store/knowledge-documents.ts backend/src/knowledge/collaboration/page-collaboration-desktop.ts
node scripts/verify-knowledge-boundaries.mjs
```

**4 tests / 0 fail / 11 assertions**（store 2 + 真实监听器集成 2），lint 与边界（224 文件）通过；backend typecheck 本任务文件零错误。

## 通过的实际流程（逐条对应验收标准）

- **sidecar 持久化 Yjs 更新/状态**：官方 provider 客户端连桌面监听器编辑 → 防抖（测试 100/300ms，生产 2s/10s）后 state+stateVector 落 knowledge_page_document；store 层字节级 round-trip、同 scope 新态覆盖、跨 workspace/page 行隔离、数据库重开后行存活全部实测。
- **重启/离线/重连收敛**：监听器销毁 + 数据库 close/reopen 后新客户端 sync 即恢复 'offline draft'（重启收敛）；副本被"云端更全状态"推进后重载，本地离线编辑与云端编辑并存（CRDT 合并，非覆盖）——'offline draft' 与 'cloud edit •' 同时在场。
- **Rust 不写知识库业务**：副本读写全部在 sidecar TypeScript（bun:sqlite 隔离在 store 层），Tauri 壳零参与。
- **与服务端正文权威清晰**：桌面装配 onConnect 仅做严格 page:<uuid>:<uuid> 文档名校验（无本地 PG/认证器，边界为回环+操作系统用户会话，注释与文档言明）；权威与收敛语义如上。

## 明确边界

桌面与云端的在线同步桥（sidecar 把副本与远端 doc_state 做 SV 交换的调度）属 Z02/Z03 装配与后续桌面集成；Tauri WebView 实机验证未做（本会话不构建 Tauri）。旧 sidecar knowledge_project/document 等旧模型表 untouched（Z01 清理）。
