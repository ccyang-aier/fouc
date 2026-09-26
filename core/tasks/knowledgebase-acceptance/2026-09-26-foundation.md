# 知识库基础阶段验收记录 · 2026-09-26

## F00 · 任务计划与 DAG

- 设计依据：`docs/product/V1/design/knowledgebase/fouc-knowledgebase-product-design.md`，已完整阅读 0–12 章及全部子节。
- 产物：`core/tasks/knowledgebase-tasks.json`（唯一状态源）、`core/tasks/fouc-knowledgebase-tasks.md`（生成任务表/完整 Mermaid DAG/覆盖矩阵）。
- 命令：`node scripts/verify-knowledge-tasks.mjs --write`；人工复核后最终结果：99 tasks / 42 sections，无环、无未知依赖、无未覆盖章节；最终验收节点传递覆盖所有任务。
- 命令：`node --test scripts/verify-knowledge-tasks.test.mjs`；结果：4 passed，包括独立分支拓扑排序、拒绝循环/未知依赖、拒绝漏章、拒绝无证据或前置未通过的验收。
- 架构审计：共享领域先于运行时服务；鉴权/权限先于 CRUD/协同，网关与索引先于检索和工具，MCP 复用工具；部署综合验收置于真实服务实现后。异步撤权窗口显式采用 fail closed；所有业务表都包含 workspace_id。
- 边界：本验收仅证明计划覆盖与追踪结构正确，不声称任何尚未实现的功能完成。

### DAG 人工复核补充

独立拆出 Teamspace 服务 O03、CRDT 来源/撤销内核 B00、服务端 Awareness B09，消除后端 AI 工具对客户端持久化/React 编辑器的逆向依赖。看板 U07 与日历 U11 独立并行验收。导入明确依赖正文持久化，Notion 数据库导入明确依赖行页面服务。共享历史差异算法不依赖后端检查点实现。

再拆出服务端 tRPC A00 和身份界面 A04；客户端 U01 明确 SaaS/私有部署端点配置。backlink 唯一投影入口归 L01，索引依赖它。只读工具直接依赖检索等领域服务，上下文组装供 Agent 调用流程使用。媒体派生任务若声称搜索/AI 可读，必须以前述真实服务为前置。

## F01 · 工作区与依赖边界

- 固定共享语义依赖版本：Tiptap/ProseMirror 3.31.3、Yjs 13.6.33、y-prosemirror 1.3.7、Zod 4.6.5、unified/remark；锁文件已更新。
- `pnpm shared:typecheck`、`pnpm backend:typecheck`：通过。
- `node node_modules/typescript/bin/tsc --noEmit --incremental false --generateTrace .next/knowledge-typecheck-trace`：退出 0，前端完整无缓存类型检查通过。原增量检查出现停滞，未把超时当成通过。
- `pnpm backend:test`：36 passed / 0 failed，151 assertions。
- `node --test scripts/verify-knowledge-tasks.test.mjs scripts/verify-knowledge-boundaries.test.mjs`：7 passed；覆盖共享代码误引 UI/Node、后端相对路径误引前端、前端只允许导入后端类型等边界。
- `pnpm knowledge:verify`：通过；边界扫描覆盖现有 19 个相关源文件。
- 边界：基础入口和防倒置校验已经就绪；功能模块及各自集成能力仍按后续任务验收。

## C01 · 共享领域契约

- `shared/src/knowledge/contracts/` 按 primitives、organization、pages、content、events 拆分，公开独立包入口 `@fouc/shared/knowledge/contracts`。
- 页面 UUID、workspace scope、teamspace、doc/database/row 关系、父子自引用、主体命名空间、四级权限、属性定义、事件、评论/检查点/资源/任务和 AI 输入均有运行时 Schema；API 元数据拒绝正文与作者注入。
- `bun test shared/src/knowledge/contracts`：7 passed / 0 failed；覆盖离线 ID/租户必填、禁止正文双写、非法页面关系、只允许元信息更新、主体/身份变体、数据库属性重复和危险键、跨租户嵌套事件、媒体地址/上传大小及转写时序。
- `pnpm shared:typecheck`、`pnpm backend:typecheck`：均退出 0；`node --test scripts/verify-knowledge-tasks.test.mjs scripts/verify-knowledge-boundaries.test.mjs`：7 passed。
- 边界：这是可共享的输入/领域验证，不代表已实现数据库授权；跨租户访问及 RLS 将在 P03/D03/Z05 的真实链路验收。

## E01 · 一方块注册表

- 27 种带身份的块、5 种文档/行内节点、10 种 marks；共享一份注册定义生成 headless ProseMirror Schema 和 Tiptap extensions，NodeView 留在前端。
- `bun test shared/src/knowledge/schema`：15 passed / 0 failed；覆盖每类块构造/JSON 往返、复杂配置、嵌套结构、注册扩展与重复拒绝、marks 共存、危险 URL 安全输出、JSON 配置无损约束。
- `pnpm shared:typecheck`：退出 0。
- 主代理复核并补查了任意 href/src 原样输出风险：统一 `safeKnowledgeUrl` 已拒绝可执行协议、混淆控制字符及危险 data URL；React NodeView 后续复用此策略。
- 边界：块语义/schema 已完成；blockId 生成、实际编辑快捷键、Markdown codecs 和 React NodeView 仍分别由 E02/E04/M01/E05 等任务完成。

## 初始回归与服务基线（执行明细）

## P01 · 权限计算内核

- `bun test backend/src/knowledge/permissions`：6 passed / 0 failed；四级累积权限、显式授权只增加权限、断继承清除祖先/根默认、匿名分享不带 workspace 主体、群组退出无需重算页面、撤权重算交集收窄、跨租户/断链/循环输入拒绝。
- 主体扩展只接收服务端已验证的 membership/group/link 记录；不从客户端正文接收有效主体。
- 已验证范围：纯权限算法。数据库物化、GIN 查询、并发撤权及权限中间件仍待 P02/P03/Z05 实际验收。

## R01 · 后端角色配置与资源生命周期

- `bun test backend/src/knowledge/runtime`：5 passed / 0 failed；四角色/all、按角色必需配置、端点/端口/origin 校验、错误不回显凭据、一次性逆序关停、启动失败清理、降级健康检查。
- 角色工厂使用 Node 兼容 AbortSignal/Promise 接口；缺失角色实现直接报错，不以空实现假装服务已启动。
- 已验证范围：配置和生命周期编排，测试注册可观察资源工厂；真实 API/Collab/Worker/MCP 的端口及五组件装配分别由 A00/B01/Q01/K01/Z03 验收。

## F02 · 模型档位与安全配置

- `bun test backend/src/knowledge/ai/config.test.ts`：3 passed / 0 failed；workspace 覆盖平台默认，平台/BYOK/Ollama 三来源，未配置时明确拒绝；BYOK 绑定发起用户/工作区/供应商/撤销状态；公开设置拒绝 apiKey；embed 维度只用于 embed 档。
- 模型配置在共享层，凭据解析在 backend；不在 workspace.settings 中保存明文密钥。
- `pnpm shared:typecheck` 与针对 runtime/permissions/ai config 的完整依赖 `tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --module esnext --target es2022` 检查均通过。D01 Agent 同时编辑全局数据库 schema，最终整体类型检查随后统一进行。
- 边界：配置解析通过不代表真实 AI 调用；网关和真实模型验证仍待 G01/G02/Z07。

## E02 · 块身份完整性

- `bun test shared/src/knowledge/schema/block-id.test.ts`：15 passed / 0 failed；真实 ProseMirror 拆分/合并、嵌套块、重复修复、剪贴板位置、跨页来源、同页拖动及导入/恢复区别均有断言。
- 主代理复验整个 schema 与 D01 测试：42 passed / 0 failed，308 assertions；共享类型检查通过。
- 粘贴在 Slice 进入文档前重分配 ID，避免粘到原块前方误改原始身份；服务端修复保留合法 ID，客户端来源按 EditorView 隔离。
- 边界：本验收为编辑器无 UI 内核；多浏览器协作与实际编辑控件仍待 E03/Z04/Z06。

## D01 · Postgres 唯一表模型

- 24 张知识库业务表与 4 张全局身份表；业务表含非空 workspace_id 和租户复合外键；正文仅保存 Yjs 二进制，向量切换 staging 不复制正文。
- `bun test backend/src/database/knowledge/schema.test.ts`：12 passed；`bun backend/scripts/knowledge-schema.ts --check`：无 DDL 漂移；整体后端类型检查通过。
- 模型档位枚举直接引用 F02 共享定义，DAG 已显式补充该硬依赖。
- 边界：未将静态 schema 验证当成真实初始化/RLS 通过；D02/D03 继续独立验收。

## 追加验证与安全配置

- 计划校验器增加最终节点传递覆盖及进行中依赖门禁用例，与边界测试合计 9 passed。
- 用户提供的模型配置仅保存在 gitignored 的服务端本地环境文件；不记录密钥，未声称模型调用已经验证。实际网关与能力验证属于 G01/Z07。

## 初始回归基线

- `pnpm backend:typecheck`：通过（只读审计执行）。
- `pnpm backend:test`：36 passed / 0 failed，13 files / 151 assertions（只读审计执行）。
- `http://localhost:3000/`：HTTP 200，Next dev PID 14720，复用并保持运行。
- 任务开始前已有 `next-env.d.ts` 生成变更，保留且不纳入本功能提交。
- Windows 未发现 Docker/Postgres/Redis/S3 服务；WSL 可用性在单独核查，不把 mock 结果记作真实设施验收。
