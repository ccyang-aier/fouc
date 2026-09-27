# B07 · Awareness 人/Agent 光标与在线成员 — 验收记录

- 日期：2026-09-27
- 结论：**通过**
- 交付物：`src/features/knowledge/collaboration/awareness.ts`（+测试）、`src/features/knowledge/collaboration/page-provider.ts`（awareness 透出）、`src/features/knowledge/editor/awareness/`（扩展 + 成员栏 + 实例测试）

## 验收命令（本人执行）

```bash
bun test src/features/knowledge/collaboration/awareness.test.ts src/features/knowledge/editor/awareness/ src/features/knowledge/collaboration/page-provider.test.ts
# 16 pass / 0 fail, 85 expect() calls（3 个文件，含新增惰性挂接用例）
bunx tsc --noEmit --incremental false
# 0 errors（整仓干净）
bunx eslint <B07 全部文件>
# clean
```

## 验收标准核对

- **user/color/cursor/selection/kind 完整**：发布状态逐字段满足共享 `awarenessStateSchema`（strictObject：user{id,name,image?}、#rrggbb color、kind human|agent、cursor/selection JSON、isEditing、taskId?）——纯测试以 schema.parse 验证 human 与 agent 两种形态；颜色由 8 色 harmonious 调色板按 userId FNV-1a 稳定分配。
- **两客户端能见光标**：实例测试两台真实 Tiptap Editor 绑定同一 Y.Doc 碎片 + provider 式三方 awareness 交换：A 选区变化（发布经微任务合并）→ B 渲染 2px 彩色光标 + 名字旗帜（12 字截断、自动对比度文字）与 18% color-mix 选区背景；装饰重建仅在 awareness 变化与 y-sync origin 事务时发生，其余事务映射穿透（与 y-prosemirror cursor 插件同一正确性契约）。
- **AI 正在编辑状态**：后端 J04 流式写入者发布的 `cursor: {anchor: blockId 字符串}` 形态被前端兼容渲染（相对位置 JSON 优先、blockId 字符串按 attrs.blockId 定位回退）——实例测试注入 kind:'agent' 状态渲染 ✦ Sparkle 旗帜 +「正在编辑」脉冲；空范围不画选区。B09 后端会话（openDirectConnection）与前端共用同一契约。
- **断开自动移除**：removeAwarenessStates 广播后对端装饰即刻消失；编辑器销毁同步 detach 发布器（getLocalState() 归 null，不会复活）；Hocuspocus 服务端断连清理为协议既有行为。

## 事实与权衡

- 扩展挂接为**惰性**：awareness 实例在 B04 provider（IndexedDB 加载后）才存在，扩展以 `getAwareness()` + 会话订阅在状态变化时挂接/换出发布器（避免编辑器重建）；首次 sync 必然挂接（修复了 getAwareness 初值导致的早退缺陷，由新增惰性挂接实例测试锁定）。
- 成员栏：useSyncExternalStore + WeakMap 快照缓存订阅 awareness change；42px 头部内头像堆叠（最多 5 + "+N"）、Agent Sparkle 徽标、`名字 · 正在编辑|在线` 提示、aria-label「在线成员」、空态不渲染。
- page-provider 仅新增 `awareness` getter（provider 存活期返回其实例，销毁后 null），原 5 项测试全绿并追加了生命周期断言。
