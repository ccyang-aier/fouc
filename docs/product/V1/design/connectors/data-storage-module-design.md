# Fouc 数据存储模块设计

> 状态：设计提案
>
> 适用范围：Fouc V1 及后续数据存储能力演进
>
> 参考基线：Fouc Connector 架构、`opensource/dbx` commit `f909f85075e12beb78dffe5942f7d039bede25de`（2026-09-20）
>
> 关联文档：[Connector 整体架构](./connector-architecture.md)

## 一、结论

数据存储非常适合由 Fouc Connector 纳管，但不能把它实现成一个拥有任意协议、任意命令和万能配置表单的“Database Connector”。推荐采用以下边界：

```text
Connector Control Plane
  ├── mysql Provider  ─┐
  ├── postgres Provider ├── Data Store Kernel ── SQL Workbench
  ├── redis Provider   ─┼── Data Store Kernel ── Key-Value Workbench
  ├── etcd Provider    ─┼── Data Store Kernel ── Config/KV Workbench
  └── mongodb Provider ─┘                       └─ Document Workbench
```

- **目录、实例、权限和 Agent 工具层面：MySQL、Redis、etcd 等是独立 `ConnectorProvider`。** 它们的协议、认证、资源模型、风险语义和专用管理界面显著不同。
- **工程实现层面：它们共同属于一个内置 `Data Store` 模块。** 连接生命周期、隧道、凭据、会话、取消、查询历史、结果集、导入导出、AI 上下文、审批和审计必须复用同一套 Kernel。
- **产品入口始终留在对应连接器内部。** MySQL Connector 详情页负责创建和维护多个 MySQL Instance；用户选中任一 Instance 后，详情页内部进入共享 Data Store Workbench。Redis、etcd 等也遵循相同路径，不增加独立的全局“数据工作台”菜单。
- **兼容产品不应机械拆成 Provider。** MariaDB/TiDB/OceanBase MySQL 模式等优先作为 MySQL Provider 的 `profile`；只有协议、认证、能力或工作面不能安全复用时才升级为独立 Provider。
- **Provider 不是驱动。** Provider 是用户和 Agent 可见的能力与治理边界；Driver 是 Provider 内部的连接实现；Instance 是某个用户或工作区实际保存的一条连接。
- **dbx 应作为产品行为和测试语料来源，而不是作为第二个应用嵌入 Fouc。** Fouc 不引入 dbx 的 Rust/Tauri 业务层，不运行一套平行控制面，也不复制其单体前端；应按 Fouc 的 Next.js + TypeScript sidecar 边界重写核心能力。
- **“移植所有核心能力”指目标能力完整，不代表首个版本一次支持 dbx 的 81 个连接类型。** 先建立正确内核和 MySQL、Redis、etcd 三种差异足够大的垂直切片，再扩展 PostgreSQL、MongoDB 与兼容 profiles。

这个方案与现有 Connector 文档的“一平台一 Provider、多 Instance”“通用控制面、独立数据适配器”一致，同时避免每个数据库连接器重复建设一个数据库客户端。

## 二、目标与非目标

### 2.1 目标

- 在 Fouc 内提供现代化的数据连接、浏览、查询、编辑、管理和诊断体验；
- 将数据存储变成 Work Room、Agent、Automation 和 Project 可受控使用的上下文与工具；
- 覆盖 SQL、Key-Value、文档、搜索/分析、向量、配置中心等不同数据模型；
- 复用统一的凭据、连接、权限、审批、审计、执行位置和结果裁剪机制；
- 桌面端可连接本机与内网数据源，Web 端可通过在线桌面或客户 Relay 使用；
- 逐步达到 dbx 的核心工作台能力，同时保持 Fouc 的架构和视觉语言一致；
- 为后续数据分析、数据质量、数据迁移、知识上下文和自动化触发建立稳定底座。

### 2.2 非目标

- 不在 V1 一次性追平 dbx 所有数据库和管理功能；
- 不把 Fouc 变成 dbx 的换皮版本；
- 不把 dbx 的 Rust 业务代码放入 `src-tauri/`；
- 不用一个 `execute(command: string)` 能力绕过 Connector 的 schema、策略和审计；
- 不允许模型直接获得数据库密码、完整连接串、SSH 私钥或不受限的大结果集；
- 不把所有数据源抹平成最低公分母 CRUD；
- 不在仅有少数内置 Provider 时提前建设第三方驱动市场和不受控的动态插件运行时。

## 三、事实基础

### 3.1 Fouc 当前状态

现有代码已经落下 Connector 控制面的第一条纵向切片：

- `shared/src/index.ts` 已定义 Provider、Instance、Capability、身份、健康与调用记录；
- `backend/src/connectors/service.ts` 已实现 DTS 的连接、心跳、调用审计和错误归一化；
- `backend/src/connectors/repository.ts` 与 `backend/src/store/db.ts` 已持久化 Instance、Heartbeat、Invocation；
- `src/features/connectors/` 已有 Connector Catalog 与 DTS 详情页；
- 当前实现仍是 DTS 特化：Service 直接持有 `DtsRuntime`，没有通用 Adapter Registry、Credential Broker、输入输出 schema、审批记录和通用实例创建流程；
- Catalog 已展示 MySQL 与 PostgreSQL，但还是本地演示数据，不代表已经存在 Provider。

因此数据存储模块不应绕过当前 Connector 架构另起炉灶；它应成为推动 Connector 控制面从 DTS 特例走向通用实现的第二阶段。

### 3.2 dbx 的可复用思想

对 `opensource/dbx` 的代码盘点表明，其核心不是“一个数据库驱动”，而是以下几层：

1. **声明式连接类型与能力矩阵**
   - `plugins/connection-types/*.yaml` 是连接类型事实源；当前基线共有 81 个 YAML 描述符；
   - 描述符声明 runtime mode、MCP mode、默认端口、dialect、driver profile 与产品能力；
   - MySQL、Redis、etcd 分别具有完全不同的能力矩阵和运行模式；
   - `crates/dbx-types/build.rs` 从描述符生成稳定类型和 Manifest，避免前后端枚举漂移。

2. **共享 Core + 多运行时 Driver**
   - `crates/dbx-core/` 承担查询、安全、Schema、数据传输、AI 工具和持久化；
   - `crates/dbx-drivers/` 隔离 native、file、agent 等连接实现；
   - 协议兼容产品复用已有 dialect/driver，只有协议或工作流不同才新增实现。

3. **按数据模型提供专用工作面**
   - SQL 使用 Query Editor、Schema/Object Browser、Data Grid、Explain、ER、Diff；
   - Redis 有键扫描、分组、类型编辑、TTL、Stream、Pub/Sub、Slowlog 和命令控制台；
   - etcd 有键空间、历史、Watch、Lease、集群维护和访问控制；
   - MongoDB、向量库、搜索引擎、消息队列也各有专用操作面。

4. **AI 不是裸查询入口**
   - `crates/dbx-core/src/ai/agent_tools.rs` 按数据库类型发布工具，并限制行数、单元格字符数和超时；
   - 写 SQL 与 DDL 需要绑定“本次确认的 SQL + 连接 + database + schema”，授权消费一次即失效；
   - `crates/dbx-core/src/ai/mcp_policy.rs` 支持连接、分组和 database 级范围与执行策略；
   - 生产库识别、只读连接、SQL 风险分类和危险操作确认存在独立防线。

5. **完整的数据工作流**
   - 查询与取消、手工事务、历史、片段、自动完成；
   - Data Grid 查看、过滤、排序、分页和受控编辑；
   - Schema 浏览、源码、结构编辑、ER、对比、执行计划、字段血缘；
   - CSV/Excel 导入，CSV/JSON/Markdown/XLSX/INSERT 导出，SQL 文件执行，跨库迁移与数据对比；
   - SSH/代理、TLS、只读、生产标记、连接导入导出与驱动管理。

这些能力值得参考，但 dbx 当前也存在 Fouc 不应照搬的形态：`ConnectionConfig` 汇聚了大量数据库特有字段，Tauri command 数量巨大，前端 `App.vue` 和 `queryStore.ts` 承担很多跨域协调。Fouc 应保留能力，重新划分模块边界。

## 四、为什么是多个 Provider，而不是一个 Provider

### 4.1 判断标准

一个数据源是否应成为独立 Provider，按以下顺序判断：

| 判断项 | 相同时 | 不同时 |
| --- | --- | --- |
| 协议与认证 | 可复用 Provider profile | 倾向独立 Provider |
| 资源模型 | 可复用工作面 | 独立 Provider 或独立 surface |
| 危险操作语义 | 可复用风险分类 | 必须独立能力契约 |
| 配置结构 | profile 覆盖默认值 | 独立 Provider |
| 驱动仅是实现差异 | 保持同一 Provider | 不因驱动不同拆分 |
| 用户心智与品牌 | profile/label | 若权限和能力独立则拆分 |

### 4.2 推荐归属

| 对象 | Provider | Profile / Dialect | Instance 示例 |
| --- | --- | --- | --- |
| MySQL 8.4 | `mysql` | `mysql` | 生产订单库 |
| MariaDB | `mysql` | `mariadb` | 报表库 |
| TiDB（MySQL 协议） | `mysql` | `tidb` | HTAP 测试集群 |
| PostgreSQL | `postgres` | `postgres` | 客户数据仓库 |
| Redshift | 初期 `postgres`，验证后可独立 | `redshift` | BI Warehouse |
| Redis Standalone / Sentinel / Cluster | `redis` | `standalone` / `sentinel` / `cluster` | 缓存集群 |
| etcd v3 / v2 | `etcd` | `v3` / `v2` | Kubernetes 配置中心 |
| MongoDB / Atlas | `mongodb` | `direct` / `replicaSet` / `atlas` | 行为事件库 |
| SQLite 文件 | `sqlite` | `file` | 本地分析文件 |

Redshift 这类边界对象需要以实际能力差异决定：若 Fouc 仅做 PostgreSQL 协议查询，可先作为 profile；若暴露集群管理、IAM、Spectrum 等独立能力，则应成为独立 Provider。不能只按“是否兼容某个 wire protocol”下结论。

### 4.3 三层身份必须分开

```text
ProviderDefinition          DriverDescriptor             ConnectorInstance
mysql                      mysql2/native                生产订单库
用户/Agent 可见            内部实现细节                  用户实际连接
能力、风险、配置 schema     协议、包、运行时、版本         地址、范围、凭据引用、状态
```

不要把 Driver 列表直接当 Connector Catalog，也不要为每个连接 Instance 复制 Provider Definition。

## 五、总体架构

```text
┌──────────────────────────── Fouc Product Layer ────────────────────────────┐
│ Connector Catalog/Detail · Embedded Workbench · Agent · Automation · Project│
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ typed API / WS events
┌──────────────────────── Connector Control Plane ───────────────────────────┐
│ Provider Registry · Instance Lifecycle · Credential Broker · Placement     │
│ Policy/Approval · Invocation Audit · Health · External Object References   │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ invoke(instance, capability, input)
┌──────────────────────────── Data Store Module ──────────────────────────────┐
│ Data Store Registry                                                    │
│  ├─ provider/profile descriptors     ├─ capability resolver              │
│  └─ surface/dialect mapping          └─ feature negotiation              │
│ Data Store Kernel                                                      │
│  ├─ connection/session/pool          ├─ query/cancel/transaction          │
│  ├─ metadata/cache/completion        ├─ result paging/streaming           │
│  ├─ import/export/transfer           ├─ risk classification/preflight     │
│  └─ history/snippet                  └─ AI context/tool projection        │
│ Provider Adapters                                                       │
│  ├─ mysql / postgres / sqlite        ├─ redis                            │
│  ├─ mongodb                          └─ etcd                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────── Driver Runtime Layer ──────────────────────────┐
│ Native Node-compatible drivers · local files · managed driver subprocess  │
│ SSH / proxy / TLS transport · desktop / relay execution                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 放置原则

- `backend/`：全部业务逻辑、驱动编排、策略、查询、结果处理、AI 工具投影；
- `shared/`：Provider/Instance/Capability DTO、Data Store contracts、分页与事件契约；
- `src/`：Catalog、Provider 详情、多 Instance 管理、共享 Data Store Workbench 和 Agent 协作 UI；
- `src-tauri/`：仅提供 OS Vault、文件选择、窗口、进程看护等薄桥，不放数据库业务；
- 长尾 JDBC/Agent 若采用独立进程，业务策略仍在 TypeScript sidecar，子进程只实现窄驱动协议。

### 5.2 建议代码组织

```text
backend/src/connectors/
├── core/
│   ├── provider.ts
│   ├── registry.ts
│   ├── service.ts
│   ├── credentials.ts
│   ├── policy.ts
│   ├── approval.ts
│   ├── invocation.ts
│   └── errors.ts
└── providers/
    ├── dts/
    └── data-stores/
        ├── kernel/
        │   ├── connection-manager.ts
        │   ├── session-manager.ts
        │   ├── result-store.ts
        │   ├── metadata-cache.ts
        │   ├── risk-engine.ts
        │   ├── query-history.ts
        │   └── transfer-service.ts
        ├── sql/
        │   ├── contracts.ts
        │   ├── dialect.ts
        │   └── workbench.ts
        ├── mysql/
        ├── redis/
        ├── etcd/
        └── mongodb/

shared/src/connectors/data-stores/
├── descriptors.ts
├── connection.ts
├── capabilities.ts
├── metadata.ts
├── query.ts
├── results.ts
└── events.ts

src/features/data-stores/
├── catalog/
├── connection-editor/
├── studio/
│   ├── shell/
│   ├── sql/
│   ├── redis/
│   ├── etcd/
│   └── document/
├── ai/
└── shared/
```

## 六、声明式 Provider 与 Profile

参考 dbx 的 connection type descriptor，Fouc 应为数据存储定义静态、可校验、前后端共用的描述符。V1 仍在仓库内注册，不建设第三方动态加载。

```ts
interface DataStoreProviderDescriptor {
  providerId: 'mysql' | 'postgres' | 'redis' | 'etcd' | string
  displayName: string
  family: 'relational' | 'key_value' | 'document' | 'search' | 'vector' | 'config' | 'analytics'
  surface: 'sql' | 'redis' | 'etcd' | 'document' | 'search' | 'vector'
  profiles: DataStoreProfileDescriptor[]
  connectionSchema: JsonSchema
  capabilities: DataStoreCapabilityMatrix
  executionPlacements: ConnectorTargetType[]
}

interface DataStoreProfileDescriptor {
  id: string
  label: string
  protocol: string
  dialect?: string
  runtime: 'native' | 'file' | 'driver_process' | 'http'
  defaultPort?: number
  defaults: Record<string, unknown>
  capabilityOverrides?: Partial<DataStoreCapabilityMatrix>
}
```

描述符只表达产品能力和运行绑定，不承载任意代码。新增兼容产品通常只增加 profile、图标和测试；新增协议、认证、资源模型或工作面才需要代码。

### 6.1 能力矩阵

```ts
interface DataStoreCapabilityMatrix {
  query: boolean
  cancel: boolean
  transactions: boolean
  metadataBrowse: boolean
  objectSource: boolean
  schemaSearch: boolean
  dataEdit: boolean
  structureEdit: boolean
  import: boolean
  export: boolean
  transfer: boolean
  explain: boolean
  diagram: boolean
  schemaDiff: boolean
  dataCompare: boolean
  lineage: boolean
  admin: boolean
  watch: boolean
  pubSub: boolean
}
```

UI 必须按已协商能力显示操作，不能通过“点一下看是否报错”探测；Agent 工具也只能从有效能力投影生成。

## 七、连接、凭据和执行位置

### 7.1 Instance 配置

`ConnectorInstance.config` 仅保存非敏感数据：

```ts
interface DataStoreConnectionConfig {
  profileId: string
  endpoint: { host?: string; port?: number; path?: string; endpoints?: string[] }
  defaultDatabase?: string
  defaultSchema?: string
  visibleDatabases?: string[]
  visibleSchemas?: Record<string, string[]>
  transportLayers: TransportLayerRef[]
  tls: TlsPublicConfig
  timeouts: { connectMs: number; queryMs: number; idleMs: number }
  readOnly: boolean
  productionScopes: DataStoreScope[]
  color?: string
  tags: string[]
}
```

密码、Token、客户端私钥、证书私钥、SSH 密码和 key passphrase 必须进入 Credential Broker，Instance 只保存 `credentialRef`。连接 URL 需要在解析时拆出 secret，禁止将含密码的原始 URL 回写到普通 SQLite 或日志。

### 7.2 传输层

传输与数据库协议正交，统一建模：

```text
database protocol
    ↓
optional TLS
    ↓
optional SSH / proxy / customer relay
    ↓
target endpoint
```

V1 优先支持直连 + TLS；SSH 隧道作为 P1。Transport profile 可被多个 Instance 引用，但凭据仍按 owner 和 execution target 隔离。

### 7.3 连接状态

除 Connector 通用状态外，运行时还要管理：

- idle / opening / ready / busy / closing / failed；
- pool 或 single session；
- reconnect generation，避免旧请求落到新会话；
- query execution id、取消句柄和 transaction session；
- driver/product/version/database identity；
- capability negotiation 结果。

连接测试必须返回服务端确认的信息，而不是仅做 TCP 探测。成功结果至少包含产品名、版本、当前 database、驱动名与版本；Redis/etcd 返回各自可确认的集群信息。

## 八、Capability 设计

### 8.1 通用能力

```text
datastore.connection.test
datastore.connection.open
datastore.connection.close
datastore.metadata.refresh
datastore.resource.search
datastore.result.export
```

### 8.2 SQL Provider 能力

```text
sql.catalog.list
sql.schema.list
sql.table.list
sql.table.describe
sql.object.source.get
sql.query.read
sql.statement.write
sql.statement.destructive
sql.query.cancel
sql.transaction.begin / commit / rollback
sql.explain.estimated
sql.explain.actual
sql.table.rows.read
sql.table.rows.change.preview
sql.table.rows.change.apply
sql.structure.change.preview
sql.structure.change.apply
sql.schema.diff
sql.data.compare
sql.data.import
sql.data.export
sql.data.transfer
```

### 8.3 Redis Provider 能力

```text
redis.database.list
redis.key.scan / get
redis.key.create / rename / delete
redis.key.ttl.set / clear
redis.string.set
redis.hash.field.set / delete
redis.list.item.push / set / remove
redis.set.member.add / remove
redis.zset.member.add / update / remove
redis.stream.entry.list / add
redis.stream.group.list
redis.command.read
redis.command.write
redis.command.destructive
redis.pubsub.subscribe / publish
redis.slowlog.list
redis.cluster.nodes.list
```

### 8.4 etcd Provider 能力

```text
etcd.key.list / get / put / rename / delete
etcd.key.history
etcd.watch.start / poll / stop
etcd.lease.list / grant / revoke / keepalive
etcd.cluster.status
etcd.maintenance.compact.preview / apply
etcd.maintenance.defrag.preview / apply
etcd.auth.user.*
etcd.auth.role.*
etcd.auth.permission.*
```

### 8.5 为什么不能只有 `execute`

现有 `ConnectorCapabilityDefinition.effect` 是静态值，而 SQL 和 Redis command 的风险取决于内容。Fouc 不应把所有语句放入一个 effect 模糊的能力。执行链必须先解析和分类，再映射到 `read`、`write` 或 `destructive` 的规范能力：

```text
用户/Agent 提交 SQL
  → dialect parser + multi-statement split
  → scope extraction + risk classification
  → sql.query.read | sql.statement.write | sql.statement.destructive
  → policy + approval
  → execute
```

无法可靠分类时按 `destructive` 处理；不能以字符串前缀作为唯一安全判断。Redis 任意命令同样需要命令表、参数级规则和未知命令 fail-closed。etcd 等结构化 API 则直接由方法确定 effect。

## 九、核心功能范围

### 9.1 P0：可用的共享 Workbench

- Connector Catalog 中创建、编辑、复制、测试、连接、断开和删除 Instance；
- 直连、TLS、连接超时、查询超时、只读与生产标记；
- 多连接分组、颜色、搜索、最近使用；
- SQL 编辑器：高亮、格式化、元数据补全、选中执行、快捷键、取消；
- Schema Tree：database/schema/table/view/column/index/foreign key；
- Data Grid：虚拟滚动、分页、排序、筛选、复制、单元格详情；
- 查询历史、草稿与标签页恢复；
- CSV、JSON、Markdown 导出；
- Redis 键浏览、各核心数据类型查看、TTL 与受控修改；
- etcd 前缀树、值查看、put/delete、状态与 Watch；
- Fouc Agent 可列元数据、采样、执行只读查询、解释结果；
- 所有调用经过权限、限额与审计。

### 9.2 P1：专业管理能力

- Data Grid 行编辑与保存前 SQL/命令预览；
- 手工事务、批量执行、SQL 文件执行；
- CSV/Excel 导入，XLSX/INSERT 导出；
- Explain 可视化、对象源码、表结构编辑；
- ER 图、Schema 搜索、Schema Diff、Data Compare；
- SSH 隧道、代理、连接配置加密导入/导出；
- Redis Stream、Pub/Sub、Slowlog、Cluster；
- etcd Lease、Auth、Compact、Defrag；
- PostgreSQL 与 MongoDB；
- Agent 生成/解释/优化/修复查询，写操作提案与一次性确认。

### 9.3 P2：跨数据源与 Agent-Native 能力

- 跨连接数据迁移、断点续传、校验与失败恢复；
- 字段血缘、数据质量检查、敏感字段识别；
- 自动化触发：定时查询、阈值告警、Schema 变化、Redis/etcd Watch；
- 将查询结果物化为 Work Room artifact、报告、图表或可复用数据集；
- Project/Work Room 级数据源授权与可复用上下文；
- 客户 Relay 与团队共享服务身份；
- 长尾 SQL/分析数据库 driver process；
- 连接模板与企业策略下发。

## 十、AI 协作与 AI+ 设计

Fouc 的优势不是在 dbx 的 AI 面板上再套一层聊天，而是让数据能力进入统一 Agent 工作流。

### 10.1 Agent 可见工具

首批工具保持窄而稳定：

```text
list_data_sources
list_databases
list_schemas
list_tables
describe_table
search_data_objects
sample_table
run_read_query
explain_query
propose_write
export_query_result
```

Redis/etcd 使用领域工具，不伪装成 SQL：

```text
scan_redis_keys / get_redis_value / propose_redis_change
list_etcd_prefix / get_etcd_value / watch_etcd_prefix / propose_etcd_change
```

### 10.2 上下文装配

Agent 默认只获得：

- Instance 的显示名、Provider、允许范围与能力；
- 目标 database/schema/table 的最小 metadata；
- 用户明确选择的对象、SQL、结果切片或错误；
- 来源引用、采集时间和是否截断。

默认限制建议：列表 200 个对象，采样 20 行，普通查询 50 行，可请求上限 1,000 行；字符串单元格默认 200 字符、显式窗口最大 4,000 字符。大结果进入本地 Result Store，Agent 只读摘要和分页窗口。

这些数字参考 dbx 当前 Agent 工具的边界，最终应通过 Fouc 实测调整并成为可配置策略。

### 10.3 写入闭环

```text
Agent 生成变更提案
  → 规范化目标快照（Instance/database/schema/object）
  → 风险报告与影响范围
  → 用户审阅确切 SQL/命令/diff
  → 生成单次 Approval Grant
  → 执行前再次校验目标与内容哈希
  → 执行
  → 回读验证 + 审计 + 可恢复信息
```

授权必须绑定 `instanceId + scope + normalized operation hash + expiry + actor`，使用一次即消费。目标改变、内容改变、过期或重连 generation 改变都使授权失效。生产范围默认不允许 Agent 自动写；即使工作区策略允许写，也至少需要每次显式确认。

### 10.4 AI+ 场景

- 自然语言生成 SQL/Redis 查询/etcd 筛选；
- 解释慢查询、错误、执行计划和 Schema；
- 根据业务问题自动选择表、生成查询并产出图表/报告；
- 对两个环境做 Schema/Data Diff 并生成变更方案；
- 数据质量诊断与异常归因；
- 把查询证据附着到任务、报告和决策记录；
- 自动化中执行只读检查，达到条件后通知或创建工作项；
- 对变更只生成 proposal，由人审批后执行。

## 十一、安全与治理

### 11.1 三层权限

每个 Instance 和细分 scope 使用统一模式：

| 模式 | 允许 | 默认审批 |
| --- | --- | --- |
| `read_only` | metadata、读取、estimated explain | 无或策略决定 |
| `safe_write` | 有明确范围的 DML/KV 修改 | 每次或策略决定 |
| `high_risk_write` | DDL、删除、flush、权限、维护 | 必须显式审批 |

权限可在 workspace → group → instance → database/schema/key-prefix 逐层收窄。V1 不需要实现所有层级 UI，但数据模型不能只存一个 `readOnly: boolean`。

### 11.2 强制防线

- 数据库原生只读账号优先，应用侧只读是第二防线；
- 生产标记可作用于整个 Instance 或 database/schema/prefix；
- 多语句逐条分类，取最高风险；
- 未识别语法、存储过程、动态 SQL 和跨库引用 fail-closed；
- 写入使用 preview/apply 两阶段；
- 行编辑必须包含主键/唯一键或显式并发条件，防止无条件更新；
- destructive 操作显示目标、估算影响、不可逆说明和恢复方案；
- 查询支持超时、行数、字节数、并发数和取消；
- Secret、原始大结果和完整 SQL 默认不进入普通日志；审计存摘要、哈希和受控引用；
- 外部数据是非可信输入，进入模型时标记来源并防止其中内容被当作系统指令；
- Web 端不得把内网凭据上传云端后再回传桌面执行。

### 11.3 Invocation 扩展

现有 `connector_invocation` 需要增加或关联：

- actor type/id、Agent run、Automation run；
- placement 与 execution target；
- database/schema/object/key-prefix scope；
- classified effect、risk reasons、policy decision；
- approval id、operation hash；
- rows read/affected、bytes、truncated；
- query/result artifact refs；
- cancellation、retry 和 reconnect generation；
- redacted diagnostic。

## 十二、数据模型

在现有 Connector 表之外增加 Data Store 领域表。开发期直接调整为唯一正确 schema，不保留双轨兼容结构。

```text
connector_instance
connector_credential_binding
connector_grant
connector_invocation
connector_approval

data_store_runtime_state       # 可持久化的最后状态摘要，不保存活连接
data_store_query_history       # SQL/命令、目标、状态、耗时、影响行数
data_store_saved_query         # 用户保存片段与参数
data_store_metadata_cache      # 带 generation/TTL/source 的可重建缓存
data_store_result              # 结果元数据、schema、行数、截断与 artifact ref
data_store_tab_state           # 可恢复标签页，不含 secret
data_store_transfer_job        # import/export/migration 长任务
```

大结果不作为 JSON 塞入主 SQLite。Result Store 使用按任务隔离、可清理的本地文件或列式临时格式，并记录 owner、TTL、大小和内容摘要。

## 十三、前端体验与信息架构

### 13.1 一个产品入口、两级详情状态

数据存储不增加独立的全局“数据工作台”入口，完整用户路径保持在 Connector 内：

```text
Connector Catalog
  → MySQL Connector 详情
  → 创建/维护多个 MySQL Instance
  → 选择“生产订单库”
  → 在当前详情页进入共享 Data Store Workbench
```

Connector 详情页包含两个连续状态：

1. **Provider 详情 / Instance 管理状态**：说明 MySQL Provider 的能力、权限和配置，创建、编辑、测试、连接、分组和删除多个 MySQL Instance；
2. **Instance 工作状态**：选中某个 Instance 后，在同一连接器详情上下文内挂载共享 Workbench，执行查询、浏览和 AI 协作。

MySQL、PostgreSQL、Redis、etcd 等 Connector 复用同一个前后端 Workbench 模块，但向它传入不同的 `providerId`、`instanceId`、`surface` 与能力矩阵。Workbench 根据能力组合显示 SQL、Redis、etcd 或 Document 工作面，而不是由每个 Connector 复制一份页面。

路由可表达为：

```text
/connectors/mysql
/connectors/mysql/instances/:instanceId
/connectors/redis
/connectors/redis/instances/:instanceId
```

它们在视觉上始终属于“连接器”，共享 Workbench 只是详情页内部的模块边界。用户返回时回到对应 Provider 的 Instance 列表，不跳转到另一个一级产品。

### 13.2 共享 Workbench 框架

```text
┌ Connections / Resources ┬──────── Tabs + Primary Surface ───────┬ AI ┐
│ 连接分组                 │ Query Editor / Key Browser / Dashboard│    │
│ database/schema/table    │                                       │    │
│ key prefix / collection  ├──────── Results / Messages ──────────┤    │
│ 搜索、置顶、刷新          │ Grid / Plan / Diff / Logs             │    │
└─────────────────────────┴───────────────────────────────────────┴────┘
```

- SQL surface：对象树 + 编辑器 + 结果/执行计划；
- Redis surface：database/key tree + value editor + command console；
- etcd surface：prefix tree + value/history + status/watch/admin；
- Document surface：collection tree + filter/pipeline + document viewer；
- AI 右侧面板共享 Fouc 的 Agent 会话，不另建一套模型配置和对话系统；
- 所有写操作在原位预览 diff，审批完成后显示回读结果；
- 明确显示连接颜色、环境、只读/生产、执行位置、当前 database/schema；
- 离线、重连、长查询、取消、部分结果、截断、空状态均有完整反馈。

### 13.3 从 dbx 借鉴但不复制的 UI 原则

- 保留其紧凑的专业工具密度、可调整面板、标签页、多结果与专用浏览器；
- 沿用 Fouc 的颜色、排版、动效和 Work Room 交互语言；
- 拆分可测试的 feature 组件，不形成单个全局 `App` 或万能 store；
- Server state、tab state、editor state、result state、connection runtime state 分开；
- 大型 Grid 和编辑器按需加载，专用 surface 懒加载。

## 十四、API 与事件

建议的 HTTP 资源形态：

```text
GET    /api/connectors/providers?category=data-source
POST   /api/connectors/instances
PATCH  /api/connectors/instances/:id
POST   /api/connectors/instances/:id/test
POST   /api/connectors/instances/:id/connect
POST   /api/connectors/instances/:id/disconnect

GET    /api/data-stores/:instanceId/capabilities
GET    /api/data-stores/:instanceId/metadata/*
POST   /api/data-stores/:instanceId/query/preview
POST   /api/data-stores/:instanceId/query/execute
POST   /api/data-stores/:instanceId/executions/:executionId/cancel
GET    /api/data-stores/results/:resultId
POST   /api/data-stores/results/:resultId/export
POST   /api/data-stores/:instanceId/changes/preview
POST   /api/data-stores/:instanceId/changes/apply
```

长查询、Watch、迁移和导出通过 WS 事件发送进度：

```text
dataStores.runtime.changed
dataStores.execution.started
dataStores.execution.chunk
dataStores.execution.completed
dataStores.execution.failed
dataStores.transfer.progress
dataStores.watch.event
```

所有入口最终调用 Connector Service 的 `invoke`，不能由 Workbench 直接访问 Driver。

## 十五、Provider Adapter 契约

通用 Connector Adapter 之下增加数据存储窄接口；不同工作面使用不同子接口，避免万能 Adapter。

```ts
interface DataStoreAdapter {
  test(context: DataStoreContext): Promise<ConnectionProbe>
  open(context: DataStoreContext): Promise<RuntimeHandle>
  close(handle: RuntimeHandle): Promise<void>
  capabilities(handle: RuntimeHandle): Promise<NegotiatedCapabilities>
  health(handle: RuntimeHandle): Promise<HealthProbe>
}

interface SqlDataStoreAdapter extends DataStoreAdapter {
  metadata(request: MetadataRequest, context: SqlContext): Promise<MetadataPage>
  execute(request: ClassifiedSqlRequest, context: SqlContext): Promise<QueryExecution>
  cancel(executionId: string): Promise<CancelResult>
  transaction(request: TransactionRequest, context: SqlContext): Promise<TransactionResult>
  explain(request: ExplainRequest, context: SqlContext): Promise<ExplainPlan>
}

interface KeyValueDataStoreAdapter extends DataStoreAdapter {
  list(request: KeyListRequest, context: KvContext): Promise<KeyPage>
  get(request: KeyGetRequest, context: KvContext): Promise<KeyValue>
  mutate(request: ClassifiedKvMutation, context: KvContext): Promise<MutationResult>
  watch?(request: WatchRequest, context: KvContext): AsyncIterable<WatchEvent>
}
```

Adapter 返回标准结果和外部引用，不泄漏原始 driver 对象。连接池、会话和结果流由 Kernel 托管。

## 十六、dbx 能力迁移清单

| dbx 能力 | Fouc 归属 | 策略 | 阶段 |
| --- | --- | --- | --- |
| 连接类型描述符/能力矩阵 | Data Store Registry | 重建为 TS schema，保留声明式思想 | P0 |
| 连接测试/断线重连 | Kernel | 移植行为与测试场景 | P0 |
| TLS/超时/只读/生产标记 | Kernel + Policy | 直接纳入 Instance 与策略 | P0 |
| SQL 编辑器与补全 | SQL surface | React/CodeMirror 重建 | P0 |
| Schema/Object 浏览 | SQL surface + metadata | Provider 方言化 | P0/P1 |
| Data Grid | shared studio | React 虚拟表格重建 | P0 |
| 查询历史/草稿/标签恢复 | Studio state | 与 Fouc 工作对象关联 | P0 |
| Redis 专项浏览器 | Redis surface | 参考命令与数据类型覆盖 | P0/P1 |
| etcd 专项浏览器/管理 | etcd surface | 键空间 P0，管理 P1 | P0/P1 |
| AI SQL 助手 | Fouc Agent | 不移植独立模型配置；投影 Connector tools | P0/P1 |
| MCP Server | Connector tool projection | Fouc 内部 Agent 先用；外部 MCP 后置 | P2 |
| 行内编辑/变更预览 | Grid + Policy | 两阶段变更 | P1 |
| Explain/ER/Schema Diff/Lineage | SQL tools | 按方言逐步支持 | P1/P2 |
| 导入/导出/SQL 文件 | Transfer Service | 长任务、进度、取消 | P0/P1 |
| 跨库迁移/Data Compare | Transfer Service | 强校验、可恢复任务 | P2 |
| SSH/代理 | Transport Layer | 跨 Provider 共用 | P1 |
| DBeaver/Navicat/DataGrip 导入 | Connection import | 只导入配置，secret 单独确认 | P2 |
| Driver store/JDBC Agent | Managed driver runtime | 三个原生 Provider 稳定后再建 | P2 |
| dbx 插件市场 | 不纳入近期范围 | 遵循 Connector V1 非目标 | 后续评估 |
| Web/Docker 独立产品形态 | Fouc placement | 使用桌面/云/Relay，不复制 dbx 部署面 | 持续 |

## 十七、首批 Provider 的具体范围

### 17.1 MySQL

P0：

- host/port/user/password/database、TLS、直连；
- test/open/close/reconnect；
- database/table/view/column/index/foreign key metadata；
- SQL 编辑、补全、只读执行、取消、分页结果；
- explain estimated；
- CSV/JSON/Markdown 导出；
- Agent metadata、sample、read query、explain。

P1：

- 行编辑、事务、对象源码、结构变更预览；
- ER、Schema Diff、Data Compare；
- CSV/Excel 导入、XLSX/INSERT/数据库导出；
- user/admin 必须是独立高风险能力，不随普通写权限开放。

### 17.2 Redis

P0：

- standalone、TLS、database 选择；
- cursor scan，禁止生产环境 `KEYS *`；
- String/Hash/List/Set/ZSet/Stream 查看；
- key 搜索、分页、分组、值详情、TTL；
- 结构化修改与 delete/rename 确认；
- 受控命令控制台和 Agent 只读工具。

P1：

- Sentinel/Cluster、RedisJSON；
- Stream group/consumer/pending；
- Pub/Sub、Slowlog、cluster nodes；
- 批量 TTL/删除与 `FLUSHDB` 必须走 destructive approval。

### 17.3 etcd

P0：

- v3 endpoint、TLS、username/password 或 client certificate；
- prefix 分页、get、put、rename、delete；
- revision/history、cluster status、Watch；
- key prefix scope 权限；
- Agent list/get/watch 与变更提案。

P1：

- Lease list/grant/revoke/keepalive；
- Auth user/role/permission；
- Compact/Defrag 使用预检 token + destructive approval；
- v2 作为 profile，仅在真实需求存在时实现。

## 十八、分阶段实施计划

### Phase 0：Connector 通用化

- 从 `ConnectorService` 移除 DTS 类型依赖，引入 `ConnectorProvider` / `ConnectorAdapter` Registry；
- 增加通用 Instance CRUD、Credential Broker、配置 schema 校验；
- 补齐 policy、approval、actor、scope 和 invocation 审计；
- Catalog 从 Provider/Instance API 读取，删除演示连接状态；
- 建立 Data Store descriptor 生成/校验流程。

验收：DTS 行为不回退；可注册一个无 UI 的测试 Provider；secret 不进入普通数据库和日志。

### Phase 1：MySQL 垂直切片

- MySQL Provider、连接表单、Connector 详情内嵌的共享 Workbench shell；
- metadata、editor、result grid、history、export；
- Agent 只读工具与查询限额；
- 只读、生产、风险分类、取消和审计。

验收：用户和 Agent 都能在相同权限边界内完成“选连接 → 看表 → 查询 → 分析 → 导出”，写 SQL 被稳定阻止。

### Phase 2：Redis + etcd 验证抽象

- 落 Redis 与 etcd 专用 Adapter 和 surface；
- 验证 Kernel 不含 SQL 假设；
- 完成结构化变更 preview/apply 与一次性 approval；
- 增加 Watch/流式事件。

验收：新增两类 Provider 不需要修改 Connector 控制面；SQL、Redis、etcd 的风险分类和 UI 均保持领域语义。

### Phase 3：专业 SQL 与数据流

- PostgreSQL、SQLite、MongoDB；
- 行编辑、事务、Explain、结构编辑、导入导出；
- Schema Diff、Data Compare、ER；
- SSH/代理与跨连接 transfer jobs。

### Phase 4：长尾与团队能力

- 根据使用数据引入分析库、搜索、向量和配置中心；
- managed driver process/JDBC；
- workspace 授权、Relay、Automation、企业策略；
- 评估对外 MCP 暴露和第三方 Driver SPI。

## 十九、测试与验收策略

### 19.1 契约测试

每个 Provider 必须通过同一套：

- descriptor/schema 校验；
- secret redaction；
- connect/test/health/disconnect；
- timeout/cancel/reconnect generation；
- capability negotiation；
- policy/approval/audit；
- 错误归一化；
- 结果分页、截断与引用。

### 19.2 数据源测试矩阵

使用版本固定的容器配方验证：

- MySQL：正常/TLS/只读账号/锁等待/大结果/取消/跨库引用；
- Redis：standalone/Sentinel/Cluster、所有数据类型、过期、二进制值、大 keyspace；
- etcd：TLS/auth、revision/watch/lease、compact 后历史、权限拒绝；
- 网络：离线、DNS、代理、证书、半开连接、sidecar 重启。

### 19.3 安全回归

- SQL 风险语料库，包括注释、CTE、多语句、方言语法、存储过程和动态 SQL；
- Redis command 风险表与参数级规则；
- approval 目标/内容篡改、过期、重放和跨 Instance 使用；
- secret 日志扫描；
- prompt injection 数据语料；
- 行/字节/时间/并发限制；
- 生产 scope 的跨 database/schema/prefix 绕过。

dbx 的测试文件可作为行为清单和语料参考，但 Fouc 应建立自己的 TypeScript 契约测试，不把 dbx 测试运行结果当作 Fouc 的验收结果。

## 二十、开源代码使用与归属

`opensource/dbx` 使用 Apache License 2.0。Fouc 可以参考并在满足许可证义务的前提下改写或复用代码，但实施时必须：

- 记录实际复制或派生的文件、commit 和改动；
- 保留适用的版权、许可证与 NOTICE；
- 不把“看过实现后重新设计”与“直接复制代码”混为一谈；
- 优先复用行为、测试语料和领域知识，避免机械翻译 Rust/Vue 单体结构；
- 对图标、第三方驱动和各依赖分别核对许可证，不能只依赖 dbx 根许可证；
- 在首次实质代码移植前增加 `THIRD_PARTY_NOTICES` 或等价归属文件。

本文是架构分析，不构成法律意见。

## 二十一、关键决策记录

### ADR-DS-001：每种核心协议/领域工作面是独立 Provider

**决定**：MySQL、Redis、etcd 使用独立 Provider；协议兼容产品优先作为 profile。

**原因**：能力、认证、资源模型和风险边界不同；同时保持用户可理解的 Catalog 和 Agent 权限。

**后果**：需要共享 Kernel 和 capability traits，禁止 Provider 复制公共基础设施。

### ADR-DS-002：Workbench 内嵌于 Connector 详情页

**决定**：数据存储只有 Connector 产品入口；Provider 详情管理多个 Instance，Instance 详情挂载共享 Workbench。

**原因**：用户从具体数据源出发，连接管理与实际操作属于同一连续旅程。页面归属于 Connector 不妨碍内部以独立前后端模块实现大型工作台；共享模块反而能同时保留统一导航心智与工程复用。

**后果**：不增加全局 Data Studio 菜单；路由、返回行为、面包屑和权限上下文始终保留当前 Provider/Instance；Workbench 不得反向承载 Provider Catalog 或跨类型连接管理职责。

### ADR-DS-003：不嵌入 dbx，不把数据库业务写入 Rust

**决定**：按 Fouc 技术栈重建；Tauri 保持薄壳。

**原因**：避免双控制面、双凭据系统、双 AI 系统和跨语言业务分裂，遵守仓库架构契约。

### ADR-DS-004：Agent 与 UI 共用同一 Capability 执行链

**决定**：Agent tool、Automation 和共享 Workbench 最终都调用 Connector `invoke`。

**原因**：确保策略、审批、限额、执行位置和审计不可绕过。

### ADR-DS-005：先完成三种差异明显的垂直切片，再抽外部 SPI

**决定**：顺序为 MySQL → Redis → etcd，然后再稳定 Driver SPI。

**原因**：三者足以暴露 SQL 假设、流式 Watch、专用 UI 和风险模型差异；在此之前抽象插件协议会把猜测固化成长期成本。

## 二十二、最终建议

将该能力在架构上定义为 **Connector / Data Store Workbench**，产品入口完全归属于各数据存储 Connector：

- Connector Catalog 中分别展示 MySQL、PostgreSQL、Redis、etcd、MongoDB 等 Provider；
- 每个 Provider 详情页可创建和维护多个同类型 Instance；
- 用户选择某个 Instance 后，在该详情页中进入共享 Workbench，不增加外部一级菜单；
- 同协议产品使用 profile/dialect；
- 所有 Provider 共享连接、结果、安全、AI 和审计 Kernel；
- 不复刻 dbx 的应用结构，按能力分阶段迁移；
- 第一实施里程碑不是“支持 81 种数据库”，而是“同一控制面安全、完整地跑通 MySQL、Redis、etcd”。

这能同时保留 dbx 的能力广度和专业体验，又让数据存储真正成为 Fouc Agent 工作台的一部分，而不是旁挂的一套数据库客户端。
