# B08 · 本地撤销与 Agent 事务隔离

日期：2026-09-26。模块：`src/features/knowledge/collaboration/page-undo.ts`（新增，前端撤销管理模块）；复用 B00 内核 `shared/src/knowledge/collaboration/undo.ts` 与 B04 `page-provider.ts`（零改动接入）。设计依据 §5.4 离线与冲突、§9.3 AI 作为协作者。

主实现：`createPageUndo({ document, scope?, clientId?, captureTimeoutMs?, bindingOrigins? })` → 每个打开页面一个撤销控制器，挂在 B04 会话的同一 Y.Doc 上：

- `origin`：本连接 human origin（默认每会话新生成），`local`：B00 `createLocalUndoManager` 人类栈（E03 可直接 `yUndoPlugin({ undoManager })`）；
- `task(agentOrigin(taskId) | mcpOrigin(client, taskId))`：get-or-create 一个任务撤销单元（B00 `createTaskUndoManager`，captureTimeout=Infinity 聚合），`undo()` 一次撤回该任务全部更新（跨多块多事务、含 `end()` 边界后的全部单元，循环清空该 origin 的撤销栈），`redo()` 整体恢复，`end()` 关闭流式聚合边界；
- `destroy()`：清空人类栈与全部任务栈（`clear()` 释放 keep 标记）并摘除全部监听；同时监听 Y.Doc `destroy` 事件——B04 会话 `destroy()` 销毁文档时自动同等清理，幂等。

## 验证命令与真实观察

```bash
bun test src/features/knowledge/collaboration   # 28 pass / 0 fail（21 项既有回归 + 7 项新增 page-undo）
bun test shared/src/knowledge/collaboration     # 11 pass / 0 fail（B00 内核回归）
pnpm typecheck                                  # 0 错误
pnpm shared:typecheck                           # 0 错误（本次未改 shared，确认无回归）
pnpm exec eslint --max-warnings=0 src/features/knowledge/collaboration                       # exit 0
pnpm exec eslint --max-warnings=0 src/features/knowledge/collaboration shared/src/knowledge/collaboration   # exit 0
pnpm exec eslint --no-ignore --max-warnings=0 src/features/knowledge/collaboration shared/src/knowledge/collaboration  # exit 0
```

说明：项目 eslint 配置 `globalIgnores` 含 `shared/**`，任务给定命令对 shared 目录仅输出"已忽略"提示后 exit 0；按 B00 先例以 `--no-ignore` 补跑 shared 目录，0 错误 0 告警。

## 验收标准逐条落实

1. **本地 UndoManager 不撤其他人/Agent**：`local` 栈 trackedOrigins 仅含本连接 human origin（+编辑器 binding origins）且 `captureTransaction` 要求 `transaction.local`。实测：远端他人 human/agent 更新（`applyUpdate` 以 'network' origin）不进栈；本连接上以 agent/mcp/restore origin 执行的本地事务不进栈；provider 以相同 origin 字符串回放的远端更新也不进栈（`canUndo()` 保持 false）。undo 后他人/Agent 内容原样保留，redo 精确恢复。
2. **任务 origin 独立、AI 整个任务可单独撤销**：`agent:taskId` 全部事务经 Infinity captureTimeout 聚合为单一条目；实测一个任务含 2 个 XML 块 + 1 次属性修改 + `end()` 边界后的迟到块，`task.undo()` 一次全部撤回（AI 块消失、对既有块的属性修改还原、人工块与人工后续块保留），`task.redo()` 整体恢复。任务撤销不动人类栈及其 redo 栈；人类 undo 不动任务栈；不同 agent/mcp origin 互不影响（含同 MCP 客户端并发调用）。
3. **page-provider 生命周期集成**：控制器监听 Y.Doc `destroy`。实测显式 `destroy()` 后人类/任务栈清空、文档监听数回到基线（新 Y.Doc 自带 "load"/"sync" 两键，已按相对基线断言）、后续写入不再入栈、`task()` 抛错、重复 destroy 幂等；实测真实 `connectPageDocument` 会话 `session.destroy()` 同等清理。
4. **离线编辑撤销可用**：全部机制在本地栈，不依赖网络。实测无 provider 的裸 Y.Doc 上人类 undo/redo 与任务整体撤销/恢复均可用；实测真实离线会话（backend 不可达、socket 立即关闭、fake-indexeddb 本地副本）中人类撤销与任务整体撤销均生效。

**B04 状态机集成点**：撤销事务的 origin 是 UndoManager 实例本身（实测 update 事件 origin === `pageUndo.local`），满足 page-provider 的 `origin !== provider` 判定 → 触发 `local-edit` → 离线状态 `cloudPending: true`（实测断言）。人类 redo 语义：按 stopCapturing/captureTimeout 边界逐步恢复，新编辑清空 redo 栈（实测）。

## 关键决策

- 不改 page-provider：撤销清理通过 Y.Doc `destroy` 事件接入 B04 既有生命周期；local-edit 归类由既有 `origin !== provider` 规则天然覆盖。
- `task()` 循环清空该 origin 撤销栈而非单次 `undo()`：Infinity 聚合下通常只有一个条目，但 `end()` 边界/迟到写入会产生多个单元，"撤销整个任务"入口必须一次撤净。
- 整任务恢复后 redoStack 按 Yjs 标准语义：该 origin 的新写入会清空其 redo 栈（与编辑器行为一致），人类栈不受影响。

## 明确边界

- Yjs 二进制更新不携带 origin：经网络到达的后端 Agent 写入在本连接是 remote 事务，本地任务单元无法也无意覆盖——本模块的任务撤销面向本连接文档内的 agent/mcp origin 事务（客户端驱动的 Agent 写入/建议应用路径）；后端发起任务的整体撤销属其服务端路径（J 系列）。
- 任务单元须在任务首次写入前创建（B00 内核契约），晚创建则此前写入不入该单元；不声称跨进程重启的持久撤销（B00 README 同边界）。
- 未引入 Tiptap/编辑器（E03 范围）：`local` 即 `yUndoPlugin` 候选、`bindingOrigins` 透传 `ySyncPluginKey`，键盘快捷键与 AI 任务 UI 入口属后续任务。
- `taskOrigins` 为注册表只读快照，供"撤销 AI 任务"入口枚举；任务在会话生命周期内驻留（单页会话任务量有限，不做提前回收）。
