# J03 · CRDT 建议写入 Agent 工具

日期：2026-09-26。模块：`backend/server/src/modules/knowledge/ai/tools/write.ts`(+ types/registry/index 组合、`pages/tree.ts` 增 `updateAuthorizedPage`、`import-export/y-encoding.ts` 增 `insertProseMirrorBlocks` 节点级构建、shared 契约写工具输入)。

主代理实现并验证:insert/replace/delete 以 S01 建议语义在 Y 层定点落稿(元素 annotations + 文本 delta marks 两种存储形态,与 y-prosemirror 约定逐条对齐);新块分配新 blockId;正文提交经协作宿主 `openDirectConnection`(agent actor 上下文,在线编辑者实时收到、宿主钩子写 doc_state+outbox),无宿主时以同一双记录直写兜底——不存在 SQL 正文双写。

```powershell
bun test backend/server/src/modules/knowledge/ai/tools
bun test backend/server/src/modules/knowledge/pages backend/server/src/modules/knowledge/ai
pnpm backend:typecheck; pnpm shared:typecheck
pnpm exec eslint --no-ignore backend/server/src/modules/knowledge/ai/tools backend/server/src/modules/knowledge/pages/tree.ts backend/server/src/modules/knowledge/import-export/y-encoding.ts
```

**19 项工具测试(6 新增)/109 断言 + 69 项 pages/ai 回归 / 2448 断言全过**;backend 与 shared 类型检查零错误;lint 零告警。

## 验收落实

1. **insert/replace/delete/create/update_properties 权限一致**:全部经 A03 范围守卫(write 令牌)+ P03 `authorizePageAccess(edit)`;view 级与只读 PAT 分别以 `TARGET_NOT_ACCESSIBLE`/`INSUFFICIENT_SCOPE` 拒绝,与只读工具的不可区分惯例一致。
2. **openDirectConnection+agent:taskId**:宿主路径经 B09 同款 direct connection(建议 author=`agent:<userId>:<taskId>`,doc.changed actor 同形);headless 兜底直写 doc_state+outbox,双路径同构。
3. **新 ID/建议默认**:新块 UUID blockId(E02 规则;种子经 `repairBlockIds`);一切正文改动为建议(insert/delete marks),审阅接受前原文保留——replace 实测同一 suggestionId 同时覆盖删除与插入、两种文本并存。
4. **无 SQL 正文双写**:唯一权威 doc_state,经宿主钩子或等价兜底;围栏语义保持(新建页在重算前对授权拒绝,测试如实覆盖)。
5. create_page 走 T01 幂等创建(createdBy=发起者);update_properties 新增服务函数(不动 ACL,发 page.updated 语义说明;title_path 刷新按 H01 契约推迟到下次正文变化)。

## 明确边界

建议的接受/拒绝审阅由 S02 UI(中断待重启)与 S01 API 承担;流式逐块写与 Awareness 联动属 J04;MCP 侧装配属 K01(注册表已就绪);update_properties 的 workspace.event 发射在 Z03 组合根统一接线(服务层仅更新行)。
