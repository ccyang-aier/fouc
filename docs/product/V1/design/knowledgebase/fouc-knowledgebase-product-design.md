# Fouc AI Native 知识库与协同编辑器 · 架构设计文档

## 0. 设计目标与原则

### 0.1 核心诉求

| # | 诉求 | 在架构上的含义 |
|---|---|---|
| G1 | 灵活的块编辑器，对 Markdown 友好，支持多模态 | 块类型可以插拔，块 ID 稳定，Markdown 能无损往返，媒体内容能被 AI 读到 |
| G2 | 实时协作流畅 | 基于 CRDT，写入先落本地，支持离线编辑，AI 和人走同一条编辑通道 |
| G3 | 同时面向个人和团队 | 个人和团队用同一个数据模型，权限可以继承，支持 SaaS 和私有部署 |
| G4 | AI Native | AI 是协作者，编辑以块为单位且可追溯，检索带权限且附引用，通过 MCP 对外开放 |

### 0.2 设计原则

1. **每类数据只有一个权威来源**。文档正文以 Yjs 为准，结构、权限和元数据以 Postgres 为准，不存在双写。
2. **块是一等公民**。每个块都有稳定的 `blockId`。引用、评论、检索、AI 编辑都以块为单位定位。
3. **Markdown 是通用交换格式**。导入导出、AI 读写、MCP 都使用它。
4. **AI 不走特权通道**。AI 的编辑和人一样写入 CRDT，一样受权限约束，也一样可以撤销。
5. **基础设施最小化**。服务端运行时只有 5 类组件：Postgres、Redis、S3、Backend、Media Worker。

---

## 1. 技术选型

| 层 | 选型 | 用途 |
|---|---|---|
| 工程 | TypeScript 全栈，pnpm workspace | 沿用现有根工程与 `backend`、`shared` 工作区，前后端共享类型、Schema 和 Markdown 转换代码 |
| 前端 | Next.js App Router + React + TanStack Query | 沿用现有 `src/` 与静态导出能力，Web 端和桌面端共用一份界面代码 |
| 桌面端 | Tauri 2 + Bun sidecar | Tauri 只负责窗口、系统能力桥、更新和进程看护；业务逻辑运行在 TypeScript sidecar |
| 编辑器 | Tiptap（ProseMirror） | 编辑器内核，以及 NodeView、输入规则、快捷键等扩展能力 |
| CRDT | Yjs + y-prosemirror | 协同数据结构，也是正文的权威来源 |
| 离线 | y-indexeddb（Web）+ SQLite（桌面） | Web 在 IndexedDB 持久化；桌面由现有 Bun sidecar 写入 SQLite，均支持离线编辑 |
| 协同服务 | Hocuspocus v4 + Redis 扩展 | 运行在 TypeScript 后端中，负责 WebSocket 同步、鉴权、持久化和多节点广播 |
| Markdown | unified / remark（mdast）↔ ProseMirror | 双向转换，分为标准 Markdown 和 AI 方言两种格式 |
| API | Hono + tRPC | 沿用 `backend/` 的 Hono 服务边界，补充 tRPC 作为知识库内部类型安全接口 |
| 认证 | Better Auth | 邮箱登录、OAuth、OIDC/SSO、个人访问令牌（PAT），可以自托管 |
| 数据库 | PostgreSQL（ParadeDB 镜像） | 元数据、Yjs 状态、权限、检索、任务队列 |
| 全文检索 | pg_search（BM25 + jieba 分词） | 中英文关键词检索 |
| 向量检索 | pgvector（HNSW 索引） | 语义检索 |
| 任务队列 | graphile-worker | 异步任务、Outbox 消费、长时间运行的 AI 任务 |
| 对象存储 | S3 兼容存储（生产用 S3/R2，私有部署用 MinIO） | 图片、音视频、PDF 等资源 |
| AI 接入 | Vercel AI SDK | 多模型接入、流式输出、工具调用；支持用户自带 Key，本地模型用 Ollama |
| AI 协议 | MCP Server（Streamable HTTP + OAuth 2.1） | 让外部 Agent 读写知识库 |
| 媒体解析 | Python Media Worker（Whisper + Docling） | 音视频转写、PDF/Office 文档解析 |
| 可观测性 | OpenTelemetry | trace、指标、日志；token 用量记录在 Postgres |
| 部署 | Bun sidecar + Docker 镜像 + Docker Compose | 桌面端分发编译后的 sidecar；SaaS 和私有部署复用同一套 Node 兼容后端代码与镜像 |

> **认证与组织体系的当前定位（预留实现，非最终成果）**：Fouc 产品自身的认证与账户体系尚未建立。知识库任务中基于 Better Auth 的邮箱登录、OAuth/OIDC SSO、PAT（A01～A03）以及 Workspace/成员/Teamspace 组织模型（O01/O03），当前定位是**预留的代码实现**——用于端到端验证请求边界、租户隔离、RLS 与主体权限这条安全链路，不代表最终账户成果。知识库的身份与组织体系最终必须与 Fouc 全局的认证、账户体系结合分析后再定型。届时预期保留的是：请求边界与发起者上下文、PAT、主体权限模型与租户隔离；可能替换的是身份提供方与会话来源——Better Auth 上升为 Fouc 全局身份服务，或改为校验 Fouc 账户体系签发的凭证并映射到知识库主体。在方向确定前，登录相关客户端界面（A04）不过度打磨。

---

## 2. 总体架构

```
┌──────────── 客户端（Next.js App Router；Web / Tauri 2 共用 UI） ─────────────┐
│  编辑器层：Tiptap + 块注册表 + blockId 插件 + 建议模式 + 评论标记            │
│  协同层：  Y.Doc（每页一个）+ Awareness（人和 AI 的光标）                    │
│  本地层：  Web 使用 y-indexeddb；桌面通过 Bun sidecar 使用 SQLite            │
│  数据层：  TanStack Query（tRPC）· 工作区事件订阅                             │
└───────────┬──────────────────────────────────────────┬───────────────────────┘
            │ WebSocket（Yjs 同步 + 无状态消息）          │ HTTPS（tRPC / 上传预签名）
┌───────────▼──────────────────────────────────────────▼───────────────────────┐
│       Fouc Backend（TypeScript；Bun 默认运行，保持 Node 兼容；按角色启动）    │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ Collab 角色     │  │ API 角色       │  │ Worker 角色   │  │ MCP 角色      │   │
│  │ Hocuspocus v4  │  │ Hono + tRPC   │  │ graphile-    │  │ MCP Server    │   │
│  │ 鉴权/持久化钩子 │  │ Better Auth   │  │ worker       │  │ （复用 Agent  │   │
│  │ 工作区频道      │  │ 检索/权限/分享 │  │ 索引/AI/媒体  │  │  工具层）     │   │
│  └───────┬────────┘  └──────┬────────┘  └──────┬───────┘  └──────┬────────┘   │
│          └──── Redis（Hocuspocus 跨节点广播） ───┘                 │            │
└──────────┬───────────────────┬────────────────┬──────────────────┬───────────┘
           │                   │                │ HTTP              │
┌──────────▼───────────────────▼────────┐  ┌────▼──────────────┐  ┌▼──────────┐
│ PostgreSQL（ParadeDB）                  │  │ Python Media      │  │ 模型提供方  │
│ 元数据 · Yjs 状态/检查点 · 权限 · 块索引 │  │ Worker（无状态）   │  │ 云端 / Ollama│
│ BM25 · pgvector · Outbox · 任务队列      │  │ Whisper · Docling │  └────────────┘
└──────────────────┬──────────────────────┘  └───────────────────┘
                   │
               ┌───▼───┐
               │  S3   │  资源文件（按工作区内的内容哈希寻址）
               └───────┘
```

**运行时组件**：服务端部署仍保持 Postgres、Redis、S3、Backend、Media Worker 五类组件。Backend 使用同一套 TypeScript 代码，通过 `ROLE=collab|api|worker|mcp` 决定启动角色；默认运行时是 Bun，同时限制在 Node 兼容 API 子集内。私有部署时可以让全部角色运行在一个进程中。桌面端由 Tauri 看护编译后的 `fouc-backend` sidecar，Rust 层只负责系统集成，不承载知识库业务逻辑。

---

## 3. 数据模型

### 3.1 权威来源划分

| 数据 | 权威来源 | 理由 |
|---|---|---|
| 页面正文（块） | Yjs 文档，持久化到 `doc_state` | 需要实时协作和离线合并 |
| 页面树、页面属性 | Postgres | 和权限强相关，需要事务和约束 |
| 权限 | Postgres | 检索和 RLS 需要在 SQL 里直接使用 |
| 评论线程 | Postgres（锚点在 Yjs 的 mark 里） | 评论有独立的生命周期，还要发通知 |
| 块索引（文本、向量） | 派生数据，由 Yjs 生成 | 随时可以重建 |

Web 端的 IndexedDB 与桌面端的 SQLite 都是本地离线副本，不是第二套业务权威来源：当前编辑状态始终由内存中的 Y.Doc 驱动；联网后与服务端 Y.Doc 合并，服务端再把持久状态写入 `doc_state`。桌面 SQLite 的读写由 `backend/` sidecar 负责，Tauri Rust 层不直接处理文档数据。

### 3.2 核心表

```sql
workspace(id, name, kind /* personal | team */, settings jsonb)
member(workspace_id, user_id, role /* owner | admin | member | guest */)
group(id, workspace_id, name) · group_member(group_id, user_id)

teamspace(id, workspace_id, name, default_access)
page(
  id uuid,                -- 由客户端生成，离线时也能创建
  workspace_id, teamspace_id,
  parent_id, position text, -- 分数索引（fractional indexing）排序
  path ltree,             -- 祖先路径，用于继承和子树查询
  kind /* doc | database | row */,
  database_id,            -- kind=row 时指向所属的数据库页
  properties jsonb,       -- 数据库行的属性
  title, icon, cover, created_by, updated_at, deleted_at
)

doc_state(page_id, state bytea, state_vector bytea, updated_at)   -- 当前 Yjs 全量状态
doc_checkpoint(id, page_id, state bytea, created_at, authors uuid[], label)  -- 历史版本

page_acl(page_id, principal /* user:x | group:x | workspace:x | link:x */, level, inherited bool)
page_effective_acl(page_id, principals text[] /* 按 level 分列 */)  -- 物化结果

block_index(
  workspace_id, page_id, block_id, block_type,
  content_md text, content_hash, embedding vector(N), embed_model,
  principals text[],      -- 从 page_effective_acl 复制过来，检索时先过滤
  updated_at
)
backlink(src_page_id, src_block_id, dst_page_id, dst_block_id)
asset(workspace_id, hash, mime, size, meta jsonb, derived jsonb /* OCR、转写、解析结果 */)
comment_thread(id, page_id, status) · comment(id, thread_id, author, body_md)
outbox(id, topic, payload jsonb, created_at)
ai_task(id, workspace_id, kind, status /* running | awaiting_approval | done | failed */, state jsonb)
```

所有业务表都带 `workspace_id`，并开启 **RLS**：每个请求开始时执行 `SET app.workspace_id`，在数据库层隔离租户。

### 3.3 组织模型

`Workspace → Teamspace → Page 树 → Block`。个人版就是只有一个成员的 Workspace（`kind=personal`），和团队版使用同一套代码路径。

**数据库即页面**：数据库本身是 `kind=database` 的页面，每一行是 `kind=row` 的页面，属性存在 `properties`，行的正文是它自己的 Y.Doc。这样表格、看板、日历只是同一组行页面的不同视图。行天然支持打开、引用、检索、设置权限和 AI 操作，不需要另写一套逻辑。

---

## 4. 编辑器

### 4.1 块模型

- 块就是 ProseMirror 中带 `blockId` 属性的顶层节点，以及列表项、表格等容器内的子节点。
- 块类型包括：段落、标题、列表、待办、引用、提示框（callout）、代码、数学公式、表格、分栏、图片、视频、音频、文件、嵌入、块引用、页面链接、数据库视图、AI 块。

### 4.2 块注册表

每种块只需要注册一个定义对象，不用改编辑器内核：

```ts
defineBlock({
  name: 'callout',
  schema: { content: 'block+', attrs: { emoji: { default: '💡' } } },
  view: CalloutNodeView,                        // React NodeView
  markdown: {                                   // 双向转换
    toMd: (node, ctx) => directive('callout', node.attrs, ctx.children()),
    fromMd: { directive: 'callout' },
  },
  ai: { describe: n => `提示框：${n.textContent}` }, // 给 AI 的表示（可选，默认输出 Markdown）
  index: { mode: 'text' },                      // 索引方式：text | media | skip
  slash: { title: '提示框', keywords: ['callout', 'tip'] },
})
```

扩展能力以一方包的形式注册。编辑器不执行第三方代码，这样可以避开沙箱带来的复杂度和安全风险。

### 4.3 blockId 完整性

用一个 ProseMirror 插件（`appendTransaction`）统一保证以下规则：

| 场景 | 规则 |
|---|---|
| 新建块 | 生成 nanoid |
| 拆分块（回车） | 前半部分保留原 ID，后半部分生成新 ID |
| 合并块 | 保留前一个块的 ID |
| 粘贴或复制 | 一律重新生成 ID（跨页面粘贴保留来源信息，写入 `sourceBlockId`） |
| 协同冲突导致 ID 重复 | 按文档顺序检查，后出现的重新生成 |

### 4.4 Markdown

- **输入**：支持 Markdown 快捷语法（输入规则）；粘贴时自动识别 Markdown、HTML 和纯文本。
- **标准 Markdown（给人用）**：GFM 加指令语法（`:::callout{emoji=💡}`、`::embed{url=…}`），数学公式用 `$…$`，wiki 链接用 `[[页面]]`。可以无损导入导出 Obsidian 仓库，也能导入 Notion 导出的内容。
- **AI 方言（给 AI 用）**：在标准 Markdown 的基础上，每个块末尾加一个锚点 `{#b:xxxx}`，媒体块内联它的派生文本：

```md
## 季度目标 {#b:k3f9}
- 完成 AI 助手上线 {#b:p2m1}
![架构图](asset:9a8f…){#b:x7q2}
> [图像描述] 三层架构：客户端、协同服务、数据层…
```

两种格式由同一套 remark 管线生成，差别只在一个开关。

### 4.5 建议模式（Track Changes）

- 使用两个自研的 mark：`suggestion_insert` 和 `suggestion_delete`，属性包括 `{ suggestionId, author, createdAt }`。
- 开启建议模式后，插入内容带上 insert mark；删除时不真正删掉内容，而是加上 delete mark。
- 接受或拒绝的时候，按 `suggestionId` 批量去掉 mark，或者删除对应内容，整个操作在一次事务里完成。
- 人和 AI 共用这套机制。AI 的默认写入就是建议模式。

### 4.6 评论与块引用

- **评论**：在选中的内容上加 `comment` mark，属性是 `{ threadId }`。线程内容存在 Postgres。mark 跟随 CRDT 移动，协作过程中锚点不会漂移。
- **块引用**：在引用的位置渲染被引用块的实时只读内容（按需加载来源页的 Y.Doc 并定位到该块），点击跳转到原文编辑。同时写入 `backlink` 表。

---

## 5. 实时协作

### 5.1 文档生命周期

```
客户端打开页面
  → Web 从 y-indexeddb 加载；桌面从 sidecar 的 SQLite 加载（均可立即编辑）
  → 通过 WebSocket 连接 Hocuspocus
      onAuthenticate：校验会话或令牌，查询 page_effective_acl，判断能否打开以及是否只读
      onLoadDocument：从 doc_state 加载
  → 双方交换 state vector，只传缺失的更新
编辑 → 同步到本地持久层和服务端 → 通过 Redis 广播给其他节点
      onStoreDocument（2 秒防抖，最长 10 秒）：写入 doc_state，并在同一事务里写入 outbox(doc.changed)
```

### 5.2 历史版本

- Yjs **保持开启 GC**，文档体积不会无限增长。
- 检查点的生成策略：距上个检查点超过 10 分钟且有新的编辑、会话结束，或者用户手动命名一个版本。检查点里记录这一段的作者。
- **查看历史**：把检查点还原成 ProseMirror 文档，和相邻版本做结构化对比（以块为单位，再细到行内文字）。
- **恢复某个版本**：把旧内容作为一次新的编辑写回当前 Y.Doc，而不是覆盖掉状态。这样正在协作的人不会被打断，恢复操作本身也能撤销。

### 5.3 工作区事件频道

页面树变化、评论、通知、数据库行变化这类非正文事件，复用同一条 WebSocket：每个客户端额外订阅一个虚拟文档 `ws:{workspaceId}`，服务端通过 Hocuspocus 的**无状态消息**推送失效通知（例如 `{ type: 'page.moved', ids }`）。客户端收到后让 TanStack Query 中对应的缓存失效并重新拉取。这样不需要新增推送组件。

### 5.4 离线与冲突

- **正文**：离线期间完全可编辑，由 CRDT 自动合并。
- **页面树、属性**：客户端生成 UUID，先乐观更新界面，写操作存进本地队列，联网后通过 tRPC 依次提交。服务端以最后一次写入为准，并做合法性校验（例如禁止移动后形成环、禁止移到无权限的位置）。校验失败时回滚本地状态，并提示用户。
- **撤销**：Yjs UndoManager 只跟踪本地发起的事务，用户的撤销不会撤掉别人或 AI 的编辑。

### 5.5 Awareness

Awareness 在线状态里包含 `{ user, color, cursor, selection, kind: 'human' | 'agent' }`。AI 以参与者身份出现，有自己的光标和“正在编辑”状态。

---

## 6. 权限

### 6.1 模型

- **级别**：`full` > `edit` > `comment` > `view`。
- **主体**：用户、群组、工作区全体成员、分享链接。
- **规则**：
  - 页面默认继承父页面的权限。
  - 可以在任意节点上显式授权，或者断开继承。
  - Teamspace 提供根节点的默认权限。

### 6.2 实现

- **显式授权**：存在 `page_acl` 表。
- **有效权限**：由 Worker 计算后物化到 `page_effective_acl`，记录每个页面每个级别对应的主体数组。计算时沿着 `path` 合并祖先的授权，遇到断开继承的节点就停止。
- **触发重算**：授权变化、页面移动、断开继承时，写入 outbox，按子树（`path <@ x`）批量重算，并同步更新 `block_index.principals`。
- **判断用户能否访问**：先展开用户的主体集合 `{user:u, group:g1…, workspace:w}`，再判断它和页面的主体数组是否有交集（`principals && $1`，使用 GIN 索引）。

之所以按页面存主体数组，而不是存成“用户 × 页面”的对应关系，是因为数据量只随页面数增长，不随成员数增长。成员加入或离开群组时也不需要重算任何页面。

---

## 7. 检索与知识索引

### 7.1 索引管线

```
outbox(doc.changed)
  → 加载 Y.Doc，转成 ProseMirror 文档，遍历所有块
  → 生成每个块的 AI 方言 Markdown，计算 content_hash
  → 和 block_index 中已有的哈希对比，只处理新增、变化和删除的块
  → 变化的块重新生成向量（按块批量调用；很短的块附带上所在标题的路径作为上下文）
  → 更新 backlink
```

- **成本**：只重新向量化变化的块，并且 onStoreDocument 已经做了防抖。
- **切换向量模型**：`embed_model` 列记录当前使用的模型。换模型后在后台重建索引，检索时只查询当前模型生成的向量。

### 7.2 混合检索

```sql
WITH bm25 AS (
  SELECT block_id, row_number() OVER (ORDER BY paradedb.score(block_id) DESC) r
  FROM block_index
  WHERE content_md @@@ $q AND workspace_id = $w AND principals && $me
  LIMIT 50
),
vec AS (
  SELECT block_id, row_number() OVER (ORDER BY embedding <=> $qv) r
  FROM block_index
  WHERE workspace_id = $w AND principals && $me
  ORDER BY embedding <=> $qv
  LIMIT 50
)
-- RRF 融合：score = Σ 1/(60 + r)，取前 20 条后交给重排序模型
```

- **先按权限过滤，再排序**，不会出现“取了 top-k 之后被权限过滤空”的情况。
- 融合使用 RRF，然后由重排序模型（通过模型网关配置）精排。
- 同一套检索同时服务搜索框、AI 问答和 MCP 的 `search` 工具。

### 7.3 中文

pg_search 配置 jieba 分词器，同时用 ICU 分词器兼容英文和其他语言。

---

## 8. 多模态

### 8.1 上传流程

1. 客户端计算文件的 SHA-256。
2. 调用 tRPC 获取预签名 URL。如果同一个工作区里已经有相同哈希的文件，直接复用（秒传）。
3. 客户端把文件直传到 S3。
4. 在文档中插入媒体块，块的属性是 `{ src: 'asset:hash' }`。
5. 写入 outbox(asset.created)。

哈希寻址的范围限定在工作区内，避免跨租户泄露“某个文件是否存在”。

### 8.2 派生处理

| 类型 | 处理 | 由谁执行 |
|---|---|---|
| 图片 | 视觉模型生成描述和 OCR | TypeScript Worker（通过 AI SDK） |
| 音频、视频 | Whisper 转写，保留时间戳分段 | Python Media Worker |
| PDF、Office | Docling 解析成结构化 Markdown | Python Media Worker |

- **调用方式**：Python Media Worker 是**无状态的 HTTP 服务**，由 `backend/` 中的 graphile-worker 任务调用，它自己不接触队列和数据库。
- **结果写入**：派生结果写入 `asset.derived`，媒体块被索引时会带上这些派生文本，因此图片、会议录音、PDF 都能被检索，AI 也能读到。

---

## 9. AI 架构

### 9.1 模型网关

- **统一入口**：所有模型调用都通过 AI SDK 发出，由同一个 `ai/gateway` 模块管理。
- **任务分档**：按任务类型选模型：`fast`（补全、改写）、`smart`（推理、Agent）、`embed`、`rerank`、`vision`。
- **配置层级**：每一档用哪个模型，在工作区设置中配置，支持平台 Key、用户自带 Key 和 Ollama 三种来源。
- **用量记录**：每次调用写入 `ai_usage` 表（token 数、耗时、模型），同时生成 OpenTelemetry trace。

### 9.2 Agent 工具层（产品内 AI 和 MCP 共用）

| 工具 | 说明 |
|---|---|
| `search(query, filters)` | 混合检索，返回块和引用 |
| `read_page(pageId, range?)` | 返回 AI 方言 Markdown |
| `insert_blocks(pageId, afterBlockId, markdown)` | 插入内容 |
| `replace_blocks(pageId, blockIds, markdown)` | 替换一个或多个块 |
| `delete_blocks(pageId, blockIds)` | 删除块 |
| `create_page(parentId, title, markdown)` | 新建页面 |
| `update_properties(pageId, props)` | 修改数据库行的属性 |
| `query_database(dbId, filter, sort)` | 查询数据库 |

- **权限一致**：每个工具都以**发起者的身份**执行，走同一套权限判断。AI 能做的事，不会超过发起它的用户。
- **写操作的执行过程**：
  1. 把 Markdown 转成 ProseMirror 片段，并分配新的 blockId。
  2. 通过 Hocuspocus 的 `openDirectConnection` 打开目标 Y.Doc。
  3. 以建议模式写入，事务的来源标记为 `agent:{taskId}`。

### 9.3 AI 作为协作者

- **流式写入**：模型流式输出 Markdown，每完成一个块就转换并写入一次，所有在线的人都能看到内容逐块出现。Awareness 中显示 AI 的光标。
- **审阅**：所有写入默认都是建议，用户逐条或一次性接受或拒绝。用户也可以在自己的会话中选择“直接应用”。
- **撤销**：AI 的写入在 UndoManager 中单独归属于 `agent:{taskId}`，可以整体撤销某一次 AI 任务。

### 9.4 交互入口

| 入口 | 实现 |
|---|---|
| 划词操作（改写、翻译、总结） | 以选区所在的块和周边上下文作为输入，结果以建议写回原位置 |
| 续写，`/ai` 命令 | 在当前块之后流式插入内容 |
| 侧栏对话 | 带工具调用的 Agent。回答中的引用 `[b:xxxx]` 渲染成可点击的链接，点击后跳转到对应的块并高亮 |
| AI 块 | 块里保存提示词和数据范围，可以手动或定时重新生成，结果以建议写入这个块的内容 |
| 长任务（整理空间、生成周报） | 以 `ai_task` 记录执行过程，由 graphile-worker 执行，每一步的状态保存到 `state`；需要审批的步骤把状态置为 `awaiting_approval`，等待用户确认后继续 |

### 9.5 MCP Server

- **协议与认证**：采用 Streamable HTTP 传输，认证用 OAuth 2.1（符合 MCP 规范），也支持个人访问令牌。
- **工具**：直接暴露 9.2 中的工具层，再加上 `list_pages` 和 `get_backlinks`。
- **与编辑器的一致性**：外部 Agent（Claude、Cursor 等）的写入同样以建议模式出现在编辑器里，标注来源为 `mcp:{clientName}`。

### 9.6 上下文组装

发给模型的上下文按以下顺序组装：

1. 系统规则，以及 AI 方言的格式说明
2. 当前页面的大纲（标题树加 blockId）
3. 选区或光标附近的块
4. 检索到的相关块
5. 对话历史

超出长度时，从后往前截断检索结果。回答时，模型必须引用 blockId。

---

## 10. 工程结构

知识库能力沿用 Fouc 当前目录边界扩展，不再另建 Vite 应用、`apps/*` 层或 Turborepo 包图。下列子目录按实现进度补齐：

```
src/
  app/                         Next.js App Router 路由与页面入口
  features/knowledge/
    editor/                    Tiptap、NodeView、建议模式、评论、斜杠菜单
    collaboration/             Y.Doc、Awareness、本地持久化与工作区事件订阅
    search/                    搜索与引用的客户端交互
    ai/                        AI 编辑、审阅与任务界面
  components/                  跨功能 UI 组件
  lib/                         浏览器端基础设施
  shell/                       Web / Tauri 共用的应用壳

backend/
  src/
    api/                       Hono 服务入口与 tRPC 路由
    knowledge/
      collaboration/           Hocuspocus 鉴权、持久化、检查点、工作区频道
      permissions/             主体展开、有效权限计算
      search/                  索引管线与混合检索
      ai/                      模型网关、Agent 工具层、上下文组装、Y.Doc 写入
      mcp/                     MCP Server，复用 Agent 工具层
      workers/                 Outbox、graphile-worker 与媒体任务编排
    database/                  PostgreSQL/Drizzle schema、迁移与 RLS 策略
    store/                     桌面本地 SQLite 访问层
    platform/                  运行时、路径、日志等平台适配
  scripts/

shared/
  src/
    knowledge/
      schema/                  块注册表、ProseMirror schema、共享块定义
      markdown/                remark ↔ ProseMirror、标准格式与 AI 方言
      contracts/               API、事件、任务与权限契约

src-tauri/
  src/                         薄壳：窗口、系统能力桥、更新、sidecar 看护

services/
  media-worker/                独立 Python 服务（FastAPI + Whisper + Docling）
```

关键点是把 `schema`、`markdown` 和相关契约放入现有 `shared/` 工作区，由前端和后端共同消费。React NodeView 等仅浏览器可运行的实现留在 `src/features/knowledge/`；Hocuspocus、索引、权限和 AI 工具等服务端实现留在 `backend/server/src/modules/knowledge/`。这样共享的是领域语义和纯转换代码，而不是把前后端运行时代码强行塞进同一个包。

---

## 11. 部署

**Docker Compose 包含以下服务：**

- `postgres`（ParadeDB 镜像，自带 pg_search 和 pgvector）
- `redis`
- `minio`（使用云端 S3 时可以去掉）
- `backend`（同一镜像；私有部署默认一个 Bun 进程运行全部角色，SaaS 按角色分别扩容）
- `media-worker`（可以使用 GPU）

**扩展方式：**

- **Collab**：水平扩展，节点之间通过 Redis 同步。
- **API、MCP**：无状态，直接水平扩展。桌面端仍由 Tauri 启动和看护本地 sidecar。
- **Worker**：按队列并发度扩展。
- **Postgres**：先纵向扩容，再加读副本分担检索负载。

---

## 12. 关键风险与对策

| 风险 | 对策 |
|---|---|
| 大文档性能 | 数据库行拆成独立页面；超长页面依靠 ProseMirror 的增量渲染，NodeView 懒加载媒体内容 |
| blockId 重复或丢失 | 由统一的插件维护；服务端索引时再校验一遍，发现重复就记录日志并修复 |
| 离线后移动页面冲突 | 服务端做合法性校验，校验失败时客户端回滚并提示 |
| AI 越权读取 | 所有工具都以发起者身份执行，检索先按权限过滤，数据库层还有 RLS 兜底 |
| AI 误改内容 | 默认建议模式，可以按任务整体撤销，并有检查点可以恢复 |
| 权限重算风暴（移动大子树） | 批量更新子树，任务在队列中去重合并；重算完成前沿用旧的权限（只会更严格，不会放宽） |
| 更换向量模型 | 通过 `embed_model` 字段隔离新旧向量，后台重建完成后再切换 |
