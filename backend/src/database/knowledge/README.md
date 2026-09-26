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
- 时间列统一为 `timestamptz`。后续写入服务负责更新 `updated_at`，不添加第二套触发器更新时间规则。

## 验收范围

D01 的元测试覆盖表清单、租户外键、类型约束、二进制映射、枚举来源、检索键和 SQL 无漂移。它不证明已在真实数据库创建，也不证明 RLS 或检索索引已生效；真实初始化和 RLS 验收属于 D02/D03，BM25/HNSW 属于 H02/H03。

参考：Drizzle 官方 [export 文档](https://orm.drizzle.team/docs/drizzle-kit-export)。
