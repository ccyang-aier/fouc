# H02 · 向量批量生成与模型换代

日期：2026-09-26。模块：`backend/src/knowledge/search/embeddings.ts`（新增）+ `embeddings.integration.test.ts`（新增 3 项）。前置：H01 块索引投影（`refreshPageBlockIndex`/`content_hash`）、G01 模型网关 embed 档（真实 Ollama all-minilm 384 维验收先例）、G02 观测记账（`createAiUsageRecorder`）、Q01 graphile-worker 消费者/重试语义。schema 变更：`database/knowledge/schema/content.ts` 的 `block_index` 增列 `embedded_hash varchar(64)`（与 embedding/embed_model/embed_dimensions 同进退的 check 扩展），新增 `block_embedding_model`（每工作区当前生效模型标记，FK→workspace）；`current.sql` 重生成并通过 `--check`；`tenant-test-database.ts` 种子数据同步（embedded_hash + 标记行），D01 元测试与 RLS/租户隔离回归全过。

## 可复现验证

```bash
bun test backend/src/knowledge/search            # 22 pass / 0 fail / 235 expect（含 H01 13 项与并行 H03 6 项回归），两轮复跑稳定
bun test backend/src/database/knowledge          # 57 pass / 0 fail（schema 变更后的 D01 元测试 + RLS/租户隔离回归）
pnpm backend:typecheck                           # 0 错误
pnpm exec eslint --no-ignore backend/src/knowledge/search   # 无告警
bun backend/scripts/database-schema.ts --check  # Knowledge current SQL matches the Drizzle source
bun backend/scripts/knowledge-ollama-check.ts    # 真实 Ollama embed 探针（2×384 维，先例见 G01 验收）
```

真实环境：一次性 disposable RLS 数据库（`fouc_rls_*`，随建随删）、普通应用角色租户事务、真实 graphile-worker 队列。真实嵌入来源：本机 WSL Docker Ollama `all-minilm`（384 维，仅回环 127.0.0.1:11434，与 G01 验收同一实例）。测试 1 的 3 次真实调用合计 6 段短文本（4 段初次重建 + 2 段差量），token 用量为网关真实上报（断言 `input_tokens > 0`，落 `ai_usage`，operation=embed）；受控桩（确定向量、失败注入、批次计数）全部经 `createModelGateway` 的 fetch 边界注入，走完整网关校验（预算/维度/invalid_response），不绕过接口。

## 架构（§7.1 向量部分 + §12 换模型对策）

- **管线衔接**：消费者 `index_embedded_blocks`（doc.changed）先调用 H01 的 `refreshPageBlockIndex`（幂等差量投影，doc_state FOR UPDATE 串行），再嵌入该页投影行——同一事件的多个同主题消费者调度顺序任意，此顺序保证嵌入的总是本事件的权威内容。模型调用全部在短事务之外（vision 消费者同款纪律）。
- **仅变化块调用**：待嵌入行 = `(embedding IS NULL OR embed_model/embed_dimensions 不等于当前生效模型 OR embedded_hash IS DISTINCT FROM 嵌入输入哈希)`。`embedded_hash` 是向量所代表**嵌入输入**的 sha256；短块输入为 `title_path\n\ncontent_md`（§7.1「很短的块附带上所在标题的路径作为上下文」——改标题/标题链同样精确重嵌受影响短块）。嵌入输入哈希的 SQL 孪生表达式（`encode(sha256(convert_to(...)),'hex')`）用于全部分层判定，TS/PG 两侧字节一致（已由 isCurrent 断言闭环）。
- **embed_model/维度隔离**：向量行绑定 (embed_model, embed_dimensions, embedded_hash)；`block_embedding_model` 每工作区一行记录当前生效模型（`readActiveEmbeddingModel` 供 H03/H04 查询侧过滤；无标记 = 无向量腿，BM25 不受影响）。消费者仅在 binding 与当前生效模型一致时嵌入——重建期间绝不把新模型向量混入 block_index；新模型向量只进 `block_embedding_staging`（PK 含模型+维度）。
- **换代原子切换**：`rebuildWorkspaceEmbeddings` = 逐批暂存（staged-at-current-hash 或已提升一致的行零调用）→ 单事务切换（FOR UPDATE 冻结比较集 → 覆盖缺口检查 → UPDATE...FROM staging 提升 → 残留检查 → 清空 staging → upsert 标记）。任何缺口（重建期间内容变化）或检查失败整体回滚：标记与全部行字节不变，旧索引持续可查。重试只补漂移块（测试实测 4 块工作区只重嵌 1 块、70 块只重嵌 6 块）；无法收敛时抛 `switch_not_converged`（graphile 安全固定消息），暂存保留供下次续跑。
- **批量/限速/重试（Q01 语义）**：顺序批次，批上限 64 值/768KB（网关上限 512 值/1MB/值 100K 字符内），每批返回后立即提交（staging upsert 或 CAS 写）→ 失败后重入跳过已提交批。网关层 maxRetries=1 + embedMany 内部并发 2。消费者失败原样上抛 → guarded 任务转 `KnowledgeJobError('consumer_failed')` → 队列退避重试（Q01 已验收的路径）；重建入口幂等可重入。单值超 100K 字符的块记 `skippedOversized` 不嵌入（永不毒化队列），仍可关键词检索。
- **写回 CAS**：`WHERE content_hash=读时哈希 AND (embedding IS NULL OR 模型=当前)`——并发新版本或已完成换代的行拒绝写入，由该版本自己的 doc.changed 事件收敛；H01 的 ACL 重同步只动 principals/aclRevision/updated_at，向量血缘不受影响。

## 通过的实际流程（逐条对应验收标准）

1. **仅变化块调用**（真实 Ollama + 网关接口边界计数）：4 块首次重建恰 1 次调用 4 值；改 1 块+删 1 块+增 1 块经真实队列消费恰 1 次调用 2 值，未变块向量血缘逐字节不变（`updated_at` 因 H01 ACL 同步可变，已按向量列断言）；同内容重放入队零调用、行集逐字节不变；70 块重建恰 [64,6] 两批；单块编辑恰 1 值。
2. **模型/维度隔离**：alpha(8 维) 重建后全行 (alpha,8)且 embedded_hash=输入哈希；标记=alpha；beta 消费者在 alpha 生效期间嵌入 0 行（改动块保留旧 alpha 向量、血缘判 stale）；beta 重建期间 staging 不可见、block_index 全行仍 alpha；切换后全行 (beta,16)、标记=beta、staging 清空、每行向量与 alpha 逐行不同。
3. **原子切换+失败回退**：重建中注入索引器并发写（嵌入返回后改写 b003 内容）→ 切换拒绝整体回滚（标记、全部向量、血缘逐字节不变），staging 保留 4 行；重试只重嵌 1 块后原子切换全部 4 行；提供者在第 1 批后全面故障（synthetic 500 → `provider_unavailable`）→ block_index 保持 70 行 alpha 快照、staging 保留 64 行已提交批；健康重试只补 6 块即切换；同目标重建复跑零调用（幂等）。
4. **批量与重试**：[64,6] 批次形状断言；消费者直接调用注入故障：`provider_unavailable` 上抛（Q01 重试路径）、投影照常推进（content_hash 前移）、向量零写入零丢失；重试句柄收敛后全部 70 行 (beta,16,血缘一致)。

## 真实嵌入调用记录

| 调用 | 来源 | 值数 | 维度 | 结果 |
| --- | --- | --- | --- | --- |
| 重建 bootstrap | 本机 Ollama all-minilm（经 G01 网关 embed 档） | 4 | 384 | success，向量两两不同，input_tokens 真实上报>0 并落 ai_usage |
| 差量消费 | 同上 | 2 | 384 | success，未变块零调用零写入 |
| 同内容重放 | 同上 | 0 | — | 无调用（幂等） |
| `knowledge-ollama-check.ts` 探针 | 同上 | 2 | 384 | success（G01 先例复核，约 13 token） |

云嵌入端点探测：`.env.knowledge.models.local` 的 GLM key 在 `open.bigmodel.cn/api/paas/v4/embeddings`（embedding-3）可用（单探针调用成功返回向量）；测试未使用云嵌入（本机 Ollama 已满足真实端到端，云调用零成本化）。

## 明确边界

- **HNSW/BM25 检索索引**：`block_index` 上的按模型表达式 HNSW 只能在生效维度确定后动态创建（`CREATE INDEX CONCURRENTLY` 不能进切换事务），归 H03/H04 查询侧；本任务交付正确性与切换语义。
- **运行时接线**：`index_embedded_blocks` 消费者与 `rebuildWorkspaceEmbeddings` 手动入口在测试内经 `startKnowledgeWorker`/直接调用验证；常驻组合根注册与「settings 变更→触发重建」的产品接线属后续任务。`search/index.ts` barrel 未加导出行（H01 同例，避免与并行 H03 改动冲突，由主线程合并时统一添加）。
- **换代的并发窗口**：切换事务 FOR UPDATE 冻结既有行；极端并发下（消费者逐行 CAS 与全行锁定交错）可能死锁，由 PG 检测中止一方，两条路径均幂等可重试。切换提交瞬间新插入的块由其仍在队列的事件收敛（标记=新模型时消费者直接补嵌）。
- **孤儿 staging**：切换提交与暂存批交错时可能残留少量 staging 行（纯暂存区，不影响 block_index/查询；下次重建切换时清空）。
- **无标记期间无向量**：首次重建前（或模型未配置）消费者不嵌入；`readActiveEmbeddingModel` 返回 null 时 H03/H04 应只走 BM25 腿。
- **大块降级**：单块嵌入输入 >100K 字符（网关单值上限）跳过向量化（`skippedOversized` 计数），关键词检索不受影响。
