# B09 · 服务端 Agent Awareness 发布

日期：2026-09-26。模块：`backend/src/knowledge/collaboration/agent-awareness.ts`。

主代理实现并验证：`createAgentAwarenessSession(hocuspocus, { documentName, identity, signal })` 以 DirectConnection 绑定页面文档，用稳定合成 client 的 scratch Awareness 编码状态并 `applyAwarenessUpdate` 注入共享 awareness——经 Hocuspocus 内建广播路径到达所有协议客户端，Agent 与真人 peer 同一呈现。

```powershell
bun test backend/src/knowledge/collaboration/agent-awareness.integration.test.ts
pnpm exec eslint --no-ignore backend/src/knowledge/collaboration/agent-awareness.ts backend/src/knowledge/collaboration/agent-awareness.integration.test.ts
```

**3 tests / 0 fail**（真实监听器 + 官方 provider 客户端观察），定向 lint 零告警。

## 通过的实际流程（逐条对应验收标准）

- **服务端 direct connection 以 Agent 身份发布 cursor/selection/正在编辑状态**：状态形如 shared `awarenessStateSchema`（user/color/kind='agent'/cursor/selection/isEditing/taskId），human peer 的 provider awareness 中实时出现并断言全部字段；identity 固定、publish 覆盖可变字段。
- **任务结束和异常清理**：`stop()` 广播移除后断开 direct connection（幂等）；AbortSignal 触发同等清理；停止后 publish 抛结构化错误。连接释放路径走 Hocuspocus 官方 store/unload 钩子。
- **协议客户端能接收**：官方 @hocuspocus/provider 客户端经真实监听器观察到 agent 状态出现与消失（本测试即其客户端）。
- 附加边界：非严格 page 文档名在开连接前即拒绝。

## 明确边界

Agent 经此会话只发布 awareness；正文写入（建议模式）属 J03 的 openDirectConnection 事务路径，本模块的 direct connection context 已带 agent actor 供其复用。会话不鉴权（调用方 J 系列须先经 P03）。
