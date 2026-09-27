# J04 验收 — 逐块流式 AI 与任务撤销

日期:2026-09-27 · 验收人:主会话 · 实现代理:J04 子代理(两任接续)· 装配:主会话

## 验收命令与结果

```
bun test backend/server/src/modules/knowledge/ai     # 57 pass / 0 fail / 228 断言(8 文件,含真实 Ollama e2e)
bun test src/features/knowledge/ai    # 5 pass / 0 fail
cd backend && bunx tsc --noEmit       # ai 文件 0 错误
```

实活:知识运行时 8711 已装配真实网关+流式任务服务(`--env-file` 加载 .env.knowledge.models.local),aiTask.* 经 tRPC 边界可达。

## 交付内容

- `ai/streaming.ts`:MarkdownStreamSplitter(增量扫描+围栏状态机+软换行不切,J04 代理修复前任三处真缺陷:幽灵空行死循环、围栏重复消费、软换行误切)、PageWriteSession(完整块到达即经 direct connection 写共享 Y.Doc+Agent awareness;无宿主时 headless doc_state+outbox 回退)、任务生命周期(进行中/完成/失败/撤销——撤销按任务 undo scope 只删本任务建议块,人编辑与其他任务不动;中途撤权 fail closed)、KnowledgeStreamingTasks 服务+tRPC aiTask.start/cancel/get/revoke。
- `shared/src/knowledge/contracts/ai-tasks.ts`:任务契约;router.ts 四过程;`src/features/knowledge/ai/`:use-ai-streaming-task hook + ai-task-status 组件(四状态/取消/撤销按钮)。
- 装配(主会话):runtime config 增 models 段(4 个 KNOWLEDGE_AI_* 可选 env),server.ts 以真实网关 bindKnowledgeStreamingTasks(协作角色传宿主);无凭据时按设计 SERVICE_UNAVAILABLE。
- **建议作者语法缺陷修复(主会话,S02 验收时发现)**:write.ts 与 streaming.ts 原产 `agent:{userId}:{taskId}`/`mcp:{userId}:{taskId}:{clientName}`(四段,parseKnowledgeOrigin 拒识,UI 退化为"人")→ 改用共享构造器 agentOrigin/mcpOrigin(`agent:{taskId}`、`mcp:{clientName}:{taskId}`),两处集成测试断言同步修正。

## 验收标准核对(逐块流式、任务撤销、协作安全)

- 逐块写入+awareness 光标 ✓(集成);取消保留已写可审阅块 ✓;整体撤销不动人编辑/其他任务 ✓;中途撤权 fail closed ✓;tRPC scope/ACL ✓;headless 回退 ✓;真实 Ollama 端到端 ✓(负载敏感,空载稳定)。
