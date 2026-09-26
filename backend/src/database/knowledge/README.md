# Knowledge PostgreSQL schema

`schema/` 中的 Drizzle 表定义是唯一 DDL 来源。`current.sql` 是当前空库初始化结果，不是版本迁移链；禁止手工维护另一套 SQL 表结构。

```powershell
bun backend/scripts/knowledge-schema.ts --write
bun backend/scripts/knowledge-schema.ts --check
bun test backend/src/database/knowledge/schema.test.ts
pnpm exec tsc --noEmit -p backend/tsconfig.json
```

生成器使用 Drizzle Kit 官方 API 对空 schema 和当前定义求差，只生成一次初始化 SQL。代码不连接数据库，不删除任何数据。Drizzle Kit 是开发依赖，后续部署初始化直接读取生成的 `current.sql`。`--check` 重新生成并逐字核验，避免 schema 与初始化 SQL 漂移。

## 边界

- `knowledge` 包含所有租户业务表，每张表都有 `workspace_id`。根 `workspace.id` TypeScript 属性直接映射物理 `workspace_id`，不重复保存租户 ID。
- `knowledge_auth` 仅包含 Better Auth 全局身份表：`user`、`session`、`account`、`verification`。身份与成员资格分离；删除成员不会破坏其历史页面和评论作者记录。Better Auth 必须配置 UUID ID 生成器。
- 所有业务表之间的外键都包含 `workspace_id`。页面、父页面和所属数据库还必须处于相同 Teamspace。`database_definition` 的类型 CHECK 和复合外键保证只有 `kind=database` 页可以拥有行。
- `page.path` 为 `ltree`；单页标签为 UUID 的 `-` 替换成 `_`。父页面为空时路径深度为 1，末尾标签始终等于自身 ID。完整祖先路径和防环由页面树事务服务维护。
- `doc_state`、`doc_checkpoint` 只保存 Yjs `bytea` 状态与 `state_vector`；转换层以 `Uint8Array` 供 Yjs 使用、以 Node `Buffer` 供 `pg` 使用。正文不写入 `page`。
- `block_index.id` 是全局唯一 `bigint generated always as identity`，供 pg_search 的 `key_field` 使用。逻辑块键仍为 `(workspace_id,page_id,block_id)`。`embedding` 为无固定维度的 `vector`；模型和维度必须一起存在并匹配，H02/H03 负责模型特定 HNSW 与 BM25 索引。
- `block_embedding_staging` 只存新模型的派生向量及对应内容哈希；旧模型在重建完成前仍由 `block_index` 提供查询。H02 验证哈希并事务切换时才替换 active 向量，避免重建期间覆盖旧模型导致漏检。
- `page.acl_revision`、`page_effective_acl.revision` 和 `block_index.acl_revision` 为权限变更后的拒绝式失效留出依据；有效权限列为按等级累积的主体集合。
- 模型密钥只在 `model_credential.encrypted_secret` 存放加密字节；`workspace.settings` 只引用公开配置和凭据 ID。PAT 与分享链接只存哈希。
- `workspace_invitation` 仅保存一次性邀请令牌的 SHA-256 哈希；待接受邮箱在工作区内唯一，禁止邀请 owner。邀请接受与成员创建、personal→team 转换由组织服务在一个事务中完成。
- 时间列统一为 `timestamptz`。后续写入服务负责更新 `updated_at`，不添加第二套触发器更新时间规则。

## 验收范围

D01 的元测试覆盖表清单、租户外键、类型约束、二进制映射、枚举来源、检索键和 SQL 无漂移。它不证明已在真实数据库创建，也不证明 RLS 或检索索引已生效；真实初始化和 RLS 验收属于 D02/D03，BM25/HNSW 属于 H02/H03。

参考：Drizzle 官方 [export 文档](https://orm.drizzle.team/docs/drizzle-kit-export)。

## 新库部署与核验

先在 PostgreSQL 创建业务数据库与独立的普通登录角色；应用角色不可拥有数据库，不可具备 superuser、BYPASSRLS、CREATEDB、CREATEROLE、REPLICATION 或管理角色成员资格。初始化账号须有建扩展和建表权限。`DATABASE_ADMIN_URL` 与 `DATABASE_URL` 分别配置管理连接与应用连接，必须指向同一数据库；开发环境也可使用被 Git 忽略的仓库根目录 `.env.knowledge.local`。不要把管理连接交给业务服务。

```powershell
bun backend/scripts/knowledge-db.ts status
bun backend/scripts/knowledge-db.ts init
bun backend/scripts/knowledge-db.ts check
```

- `status` 只读返回 `empty`、`incomplete` 或 `ready` 与检查结果。`check` 仅在 `ready` 时成功退出。
- `init` 在单一事务中执行当前生成 SQL、全部业务表的强制 RLS、应用角色最小表和序列授权，并在提交前核验实际目录。任一步失败均回滚，初始化不会写入示例业务或身份数据。
- 任一目标 schema 已存在时，`init` 明确拒绝；没有重置、升级或迁移分支。发生结构差异时先调查检查结果，不要对已有库重复初始化。
- `check` 核对表和列类型、约束名称与有效性、索引名称与方法、RLS 完整策略、扩展及有效权限。它不是任意数据库对象的完整语义 diff，也不验证后续 H02/H03 管理的检索索引。
- 业务操作使用 `withKnowledgeTenant(pool, workspaceId, callback)`，通过同一借出连接上的事务局部租户上下文访问 Drizzle。服务必须在回调内验证身份和工作区成员资格后才执行业务操作；无上下文默认不可访问业务行。不要在回调中改用 `pool.query`。
- 跨工作区发现只使用 `withKnowledgeIdentity(pool, sessionId, callback)` 的 `BEGIN READ ONLY`。`member`、`workspace` 各有一条 `FOR SELECT` 的 `own_identity` policy，只允许有效、未撤销且邮箱已验证会话发现自身成员关系。sessionId 必须来自服务端认证，不能来自请求 body；PAT 不能使用这一路径。业务写入仍由 `tenant_scope` 保护，没有 BYPASSRLS 或 SECURITY DEFINER。两种事务都显式清空另一种作用域。

真实数据库回归只创建带随机 UUID 的一次性测试库，确认创建归属后清理并验证不存在；不会删除开发主库。

```powershell
bun test backend/src/database/knowledge
```

D02/D03 实测覆盖两个租户在全部业务表上的隔离、无上下文拒绝、连接复用与失败回收、初始化原子性、复合外键和数据库行约束，以及真实 Y.Doc 的二进制保存、检查点恢复和并发收敛。CLI 用例以独立进程执行真实部署命令。
