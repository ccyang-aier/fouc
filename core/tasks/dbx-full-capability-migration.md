# DBX 全能力迁移至 Fouc：任务总表

> 状态：待实施。此文件是任务清单，不代表功能已经交付。基线为 `opensource/dbx` 的 `f909f85075e12beb78dffe5942f7d039bede25de`，核对日期 2026-09-24。

## 范围与验收规则

- **全量范围**：DBX 本地源码和中文产品文档中已实现且可使用的桌面、Web、CLI、MCP、插件、驱动与专项工作台能力；包括下文 81 个驱动类型与 104 个连接 Profile。实验性、默认关闭的能力也列入，并保留同等安全开关。不可把连接成功、静态演示、空按钮或仅有 UI 当作完成。
- **功能等价**：按 DBX 的 capability、数据库类型、运行入口和账号权限逐项验收。DBX 本身没有声明的能力不强行开放；不同版本/Edition/驱动的动态差异要保留。桌面特有功能可用 Tauri 桥接，Web 的文件路径与网络按服务器环境解释。
- **Fouc 架构**：React/Next.js 实现 UI，Bun/TypeScript sidecar 承担业务逻辑，共享契约置于 `shared/`，Tauri v2 只保留系统薄壳。DBX 的 Rust/Vue/Go 实现是行为与算法参考，迁移前记录许可证与第三方依赖；不把业务逻辑搬入 Fouc Rust 壳。
- **任务完成定义**：每行须具备真实后端通路、前端交互及加载/空/错误/取消/成功反馈、只读和生产保护、适用数据库矩阵验证、桌面及 Web 适用入口验证、必要的集成测试。数据库专属任务用对应服务实例或可重复的协议测试验证。功能与 DBX 有意差异时记录差异和验收依据。
- **依赖顺序**：`F00 → F01/F02/F03/F04 → C/S/Q/G → D/X/A/P/R`；任务可并行，但不得用一个通用模拟驱动宣称完成全部类型。现有 MySQL 工作台主要为本地样例数据，作为视觉骨架而非后端完成基线。

## 0. 清点、契约与平台底座

| ID | 任务 / 可验收交付 | DBX 对照 |
| --- | --- | --- |
| F00 | 固定 DBX 源码版本，逐条建立「功能 × 数据库 × 桌面/Web/CLI/MCP」验收矩阵，记录已实现/受限/实验性状态；本文所有任务有负责人、状态、证据链接与回归用例。 | `docs/content/docs/`、`plugins/connection-types/`、`crates/dbx-core/assets/database-drivers.manifest.json` |
| F01 | 建立 Fouc 连接、能力、对象、查询结果、任务进度、错误和权限的共享 TypeScript 契约；UI 只按后端实际 capability 显示操作。 | `crates/dbx-core/src/models/`、`crates/dbx-drivers/` |
| F02 | 在 Bun sidecar 实现驱动注册、生命周期、连接池/单连接、超时、取消、自动重连、元数据缓存/失效、长任务和流式结果；隔离各连接。 | `crates/dbx-core/src/connection/`、`query/`、`schema/` |
| F03 | 桌面 HTTP/WS 桥与 Web API/SSE 共用服务层；鉴权、会话、下载、进度、错误语义一致，Web 服务可部署。 | `crates/dbx-web/src/`、`src-tauri/src/commands/` |
| F04 | 将 DBX 能力标记、SQL 方言和连接 Profile 转为 Fouc 单一目录源；启动时校验 Profile→驱动→能力映射，未知/缺失能力不误开放。 | `plugins/connection-types/`、`plugins/dialects/` |
| F05 | 引入可重复的数据库测试矩阵、容器/测试服务、协议夹具和桌面/Web 端到端用例；每个驱动至少验证连接、故障、声明能力和只读阻断。 | `crates/*/tests/`、`apps/desktop/src/**/__tests__/` |
| F06 | 审核 DBX Apache-2.0、复用代码/素材、第三方驱动与插件许可证；保留所需 NOTICE 和依赖清单。 | `opensource/dbx/LICENSE`、`agents/`、`plugins/` |
| F07 | Web 首次设置、登录/登出、修改密码、会话 Cookie、API 鉴权与部署在子路径时的路由；桌面本地访问和 Web 登录边界分别验收。 | `crates/dbx-web/src/auth.rs`、`components/auth/LoginPage.vue` |
| F08 | 为主要数据库及版本建立可重复的本地测试实验室：容器配方、健康检查、冒烟数据、连接字段输出、端口冲突检查与一键验证；作为 Rxx 验收基础。 | `docs/content/docs/database-lab.cn.mdx`、`opensource/dbx/deploy/` |

## 1. 连接、网络、配置与安全

| ID | 任务 / 可验收交付 | DBX 对照 |
| --- | --- | --- |
| C01 | 迁移全部 104 个 Profile 的分类、搜索、默认字段、图标、默认端口、URL 模板、特色选项与动态表单；增删改复制、测试、最近/置顶/分组/颜色完整闭环。 | `plugins/connection-types/profiles/catalog.yaml`、`components/connection/` |
| C02 | 支持 URL/DSN 解析与反向填表、多认证方式、TLS/CA/客户端证书、超时与连接参数；敏感项与普通配置分离。 | `plugins/connection-types/*.yaml`、`connection/` |
| C03 | SSH 隧道、跳板/密钥/口令提示、SSH config 导入、隧道 Profile、SOCKS5、HTTP 代理/隧道、网络失败诊断和安全关闭。 | `components/ssh/`、`tunnel_profiles.rs`、`ssh-tunnel.cn.mdx` |
| C04 | 本地凭据安全存储、解锁和密码提示；配置导出 AES-GCM 加密、导入/合并/冲突处理，支持从 DBeaver、Navicat、DataGrip 导入连接。 | `connection_secrets.rs`、`keychain.rs`、`config_cmd.rs`、`connection-import.cn.mdx` |
| C05 | 连接与数据库级只读、写入解锁、SQL/命令风险分类、每次生产写入确认、危险语句/目标组保护；所有 UI、CLI、MCP 和专项 API 走同一策略。 | `crates/dbx-core/src/safety/`、`crates/dbx-sql/src/` |
| C06 | 写入前 SQL/请求预览、影响范围和失败反馈；事务提交/回滚、部分成功标识、取消行为，不以客户端禁用按钮代替服务端拦截。 | `production-safety.cn.mdx`、`query/two_phase_commit.rs` |
| C07 | Agent/JDBC/外部驱动下载、安装、版本/运行时检测、更新/卸载、缺失提示和驱动商店；系统/托管/多版本 JRE、离线 ZIP/JRE 包导入、运行时 PID/CPU/内存/Session 监控及停止/重启；兼容各驱动的 Agent 进程协议。 | `agents/`、`driver-management.cn.mdx` |
| C08 | 连接设置和 SQL 库的 WebDAV/Gist/Gitee 同步、冲突处理、手动/自动同步状态及恢复。 | `cloud_sync.rs`、`cloud-sync.cn.mdx` |

## 2. 工作台壳、导航与对象资源

| ID | 任务 / 可验收交付 | DBX 对照 |
| --- | --- | --- |
| S01 | 在 Fouc 公共顶栏/导航内实现可折叠数据库资源栏、主区和 AI/信息详情右栏；多标签、拆分/分组、拖拽、关闭确认、标签恢复与独立窗口行为。 | `components/layout/`、`tabs/` |
| S02 | 连接→数据库→Schema→表/视图/字段/索引/外键/触发器等树，异步展开、搜索过滤、计数、刷新、固定、权限/错误提示和上下文菜单。 | `components/sidebar/`、`schema-browser.cn.mdx` |
| S03 | 全局快速打开/搜索与数据库对象搜索，跨连接、数据库、Schema 的命中定位和打开。 | `components/quick-open/`、`search/`、`global_search.rs` |
| S04 | 对象浏览器覆盖表、视图、过程、函数、序列、事件、扩展、类型及特定数据库对象；列表、详情、源码/DDL、创建/修改/删除及能力门控。 | `components/objects/`、`object-browser.cn.mdx` |
| S05 | 表结构视图和编辑：列、主键、索引、约束、外键、注释、存储选项，生成/预览 DDL；SQLite 重建等方言特例正确处理。 | `components/structure/`、`schema/table_structure_sql.rs` |
| S06 | ER 图、表间关系、布局、搜索/缩放/导出；字段血缘、上下游依赖和字段来源解释。 | `components/diagram/`、`lineage/` |
| S07 | 数据库文档快照、注释、关系、DBML/文档导出与刷新；支持 CLI/MCP 同源文档上下文。 | `crates/dbx-core/src/data/docs/`、`database-docs.cn.mdx` |
| S08 | 数据库/Schema 创建与管理、对象复制/粘贴、跨库作用域、菜单权限和危险操作确认。 | `components/objects/`、`schema/` |

## 3. SQL 编辑、执行与结果分析

| ID | 任务 / 可验收交付 | DBX 对照 |
| --- | --- | --- |
| Q01 | SQL 编辑器语法高亮、方言切换、元数据补全、括号/缩进、诊断、主题、快捷键及选中/当前语句/全文件执行；中文输入与选区显示正常。 | `components/editor/`、`query-editor.cn.mdx` |
| Q02 | SQL 格式化、快速操作、参数输入、SQL snippet/模板/SQL 库、搜索、保存/打开/重命名、SQL 文件树及标签恢复。 | `sql-formatter.cn.mdx`、`sql-snippets.cn.mdx`、`saved_sql.rs` |
| Q03 | 查询目标连接/数据库/Schema 切换，多目标组执行、单/多结果导航、消息、受影响行、耗时、可取消执行、异常定位及历史重跑。 | `components/layout/SqlEditorWorkspace.vue`、`query.rs`、`history.rs` |
| Q04 | SQL 风险诊断、执行计划/Explain 可视化、优化提示、目标环境提示与可审查执行入口。 | `components/explain/`、`crates/dbx-sql/src/` |
| Q05 | 查询历史、收藏/保存、搜索过滤、执行时间/目标/状态；保留可恢复的编辑内容和连接上下文。 | `historyStore.ts`、`history.rs` |
| Q06 | 大 SQL 文件预览、编码/路径校验、分段执行、进度、失败定位/重试/取消；SQL 文件导入/恢复与 ZIP 包。 | `components/sql-file/`、`data/sql_file_import.rs` |
| Q07 | 查询结果的表格、文本、JSON、图表/指标切换；图表维度/指标配置、结果复制和导出。 | `components/chart/`、`QueryResultViewSwitcher.vue` |
| Q08 | SQL 方言解析、标识符引用、日期/二进制/NULL 格式、只读/可编辑结果判定、语句拆分及多数据库特例。 | `crates/dbx-sql/`、`crates/dbx-formats/` |
| Q09 | 编辑器悬停提示、代码折叠、别名/CTE/JOIN 补全、`Ctrl/Cmd+Click` 对象跳转；占位符 `?`、`:name`、`${name}`、`#{name}`、`@name` 与 `@set` 输入；执行范围选择器和「在新结果中执行」。 | `query-editor.cn.mdx`、`components/editor/` |
| Q10 | 对 `INSERT/UPDATE/DELETE` 提供执行前变更预览：只读改写、旧/新值对照、受影响行展示；无法安全改写时明确拒绝预览而不误报执行结果。 | `query-editor.cn.mdx`、`crates/dbx-sql/src/` |

## 4. 数据表格与数据编辑

| ID | 任务 / 可验收交付 | DBX 对照 |
| --- | --- | --- |
| G01 | 真实表数据按页/虚拟滚动加载、行号、斑马纹、空值/类型展示、列宽行高拖拽、自适应少列填满、宽表横向滚动。 | `components/grid/`、`data-grid.cn.mdx` |
| G02 | 单格、连续矩形、多行/列选择；键盘导航、复制/粘贴、上下文菜单、选择状态与右侧详情同步，首次打开不预选。 | `components/grid/` |
| G03 | 分清数据库侧 WHERE/ORDER BY 与客户端的当前结果搜索、值过滤、当前页排序；提供列筛选、LIKE/NOT LIKE、多字段排序、刷新/重置、页大小与分页，并明确显示条件的执行位置与范围。 | `components/grid/`、`data-grid.cn.mdx` |
| G04 | 单元格编辑、批量改单元格、新增/复制/删除行、脏数据标记、撤销/回滚、提交前 SQL 预览与冲突/部分失败反馈。 | `components/grid/`、`crates/dbx-sql/src/` |
| G05 | 单元格/行/列详情、字段元数据、关联数据跳转、值大文本查看、行详情动态展示与字段筛选。 | `components/grid/`、`components/objects/` |
| G06 | CSV、TSV、JSON、Markdown、XLSX、INSERT SQL 的选择/全表复制及导出；大结果分片/ZIP、进度/取消和正确转义。 | `crates/dbx-formats/`、`table_export.rs` |
| G07 | 表结构筛选、列显示/隐藏/固定、自动适宽、数据/结构工具栏、Canvas 编辑模式和上下文操作完整可用。 | `components/grid/` |
| G08 | 转置视图、列头拖拽排序、左右冻结、字段注释搜索、表/查询级布局记忆与重置、自动刷新和多次运行结果固定；未提交编辑时防止自动刷新覆盖。 | `data-grid.cn.mdx`、`useDataGridAutoRefresh.ts`、`useDataGridColumnLayout.ts` |
| G09 | 列格式化器（日期/时间、JSON 路径、掩码、模板）、选择区数量/求和摘要、复制为批量 INSERT/UPDATE、可选注释表头与标识符引用；显示格式不改变原始值。 | `data-grid.cn.mdx`、`useDataGridColumnFormatter.ts` |
| G10 | 复杂值详情支持长文本/JSON、二进制十六进制与 ASCII、图像、日期时区、空间数据与 SRID；编辑时区分 NULL、空字符串、默认值和生成值。 | `data-grid.cn.mdx`、`useDataGridLargeValues.ts` |
| G11 | MySQL 单字段按 WHERE 跨未加载分页批量更新：条件构造、预计影响行数、完整 SQL 确认与实际影响行反馈；不得伪装成可可靠回滚的逐行编辑。 | `data-grid.cn.mdx`、`components/grid/` |

## 5. 导入、传输、差异、备份

| ID | 任务 / 可验收交付 | DBX 对照 |
| --- | --- | --- |
| D01 | CSV/TSV/自定义分隔文本、JSON、XLS/XLSX/XLSM、字面量 INSERT SQL 的预览与导入；编码、行范围、空值/空白、工作表、字段映射与类型推断；现有表追加/清空或多文件多工作表批量建表，逐任务进度、部分成功与取消。 | `components/import/`、`data/table_import.rs`、`table-import.cn.mdx` |
| D02 | 跨连接/跨引擎数据传输：源目标映射、类型转换、建表/清表/追加、批量流式处理、进度/失败重试/断点与任务记录。 | `components/transfer/`、`data/transfer.rs` |
| D03 | 数据比较与同步：键列选择、差异行、字段映射、冲突矩阵、修改预览、选择性同步与风险提示。 | `components/diff/DataCompareDialog.vue`、`data/data_compare.rs` |
| D04 | Schema diff：对象树、差异/DDL、依赖排序、选项、影响报告、部署/回滚或重试；原生在线结构变更/OSC 仅在适用驱动开放。 | `components/diff/SchemaDiff*`、`schema_diff.rs` |
| D05 | 数据库/表结构与数据导出、SQL 脚本生成、格式选择、拆分包、进度/取消；区分轻量导出与数据库原生备份。 | `data/database_export.rs`、`script_generator.rs` |
| D06 | SQLite 备份、MongoDB dump/import/export；MySQL/PostgreSQL 桌面一次性与小时/日/周定时逻辑备份，库/表模式、结构/数据/对象、路径模板、只读一致性快照、保留/历史/取消清理和 MySQL 指定表恢复。 | `sqlite_backup.rs`、`mongodb_dump.rs`、`components/backup/`、`database-backup.cn.mdx` |
| D07 | 桌面文件拖放生成 DuckDB 文件查询及 CSV/JSON/Parquet 读取入口；Web 上传与服务器路径、临时文件清理分别处理。 | `useFileDrop.ts`、`buildDroppedFilePreviewSql` |
| D08 | 传输、导入、导出任务持久化与重新打开；文件下载校验、出错详情、取消和完成通知。 | `transferTaskStore.ts`、`crates/dbx-web/src/routes/` |
| D09 | 测试数据生成：按字段配置姓名、地址、日期、数字、枚举、正则、外键等生成器，预览、批量写入、进度和生产写入保护。 | `components/generate/` |

## 6. AI 与自动化入口

| ID | 任务 / 可验收交付 | DBX 对照 |
| --- | --- | --- |
| A01 | 右侧 AI Ask/Agent：当前连接/Schema/选区上下文、流式对话、生成/解释/优化/修复 SQL、复制或送回编辑器。 | `components/ai/`、`ai-assistant.cn.mdx` |
| A02 | 模型配置覆盖 Claude、OpenAI、Gemini、DeepSeek、Qwen、MiniMax、Ollama、OpenAI/Anthropic Compatible、Custom；模型发现、API 风格、认证、代理、自定义请求头、推理强度/Thinking、凭据管理、连通测试与多配置切换。 | `crates/dbx-ai-provider/`、`ai_multi_config.rs`、`ai-assistant.cn.mdx` |
| A03 | Agent 工具调用、只读 Ask 和受控执行、生产写入人工审查、会话历史、取消、错误恢复和用量/结果反馈。 | `crates/dbx-core/src/ai/`、`components/ai/` |
| A04 | MCP stdio/HTTP 服务：连接/结构/文档/查询/专项资源与工具；连接白名单、库/资源作用域、只读/读写/完全访问三级权限、认证和会话。 | `crates/dbx-mcp/`、`mcp_policy.rs` |
| A05 | CLI：列连接/库/表、描述结构、查询、上下文/文档导出、表打开 Deep Link；Table/JSON/CSV 输出、超时、文件、写入/危险操作显式参数。 | `crates/dbx-cli/`、`cli.cn.mdx` |
| A06 | 桌面 Deep Link 与外部 AI/脚本唤起目标连接、表、SQL 标签；错误目标与权限反馈。 | `deep_link.rs`、`launch_args.rs` |
| A07 | 桌面本地 CLI Agent（Claude Code、Codex、Pi，及源码已接入的其他 CLI）路径/环境配置、受限 MCP 桥；Agent 轮次/重试、`@` 表与 SQL 文件上下文、全局指令/多模板快照、按连接历史和 Markdown 导出。Web 隐藏仅适用本机的 CLI 入口。 | `crates/dbx-ai-provider/src/`、`ai-assistant.cn.mdx` |
| A08 | MCP 工具逐项对齐 DBX 清单：连接增删复制、库/表/例程/源码/Schema 文档、SQL/Redis/Mongo/消息队列、桌面打开/展示；实现批量 SQL、固定连接会话与 MySQL 显式事务、回滚/未知结果处理、工具/连接/库/资源作用域。 | `crates/dbx-mcp/`、`mcp.cn.mdx` |
| A09 | MCP Desktop 与 Web Streamable HTTP/stdio 入口，默认关闭本机 HTTP、Bearer Token 轮换、Host/Origin 白名单、远程访问显式启用与异常重启；CLI/MCP 安装包和跨平台分发。 | `mcp_http_server.rs`、`crates/dbx-mcp/`、`mcp.cn.mdx` |

## 7. 非 SQL 专项工作台

| ID | 任务 / 可验收交付 | DBX 对照 |
| --- | --- | --- |
| X01 | Redis：库/Key 前缀与类型浏览、String/Hash/List/Set/ZSet/Stream 等查看编辑、TTL、命令台、PubSub、统计/Slowlog、危险命令保护。 | `components/redis/`、`redis_cmd.rs` |
| X02 | MongoDB：库/集合/文档 CRUD、筛选/排序/分页/聚合、索引、JSON 编辑、GridFS、导入导出与 dump。 | `components/document/`、`mongo_cmd.rs` |
| X03 | Elasticsearch/Easysearch/Meilisearch/Manticore：索引/文档/Schema 浏览、搜索/原始请求、响应与 Profile 视图、适用的写入。 | `components/meilisearch/`、`Elasticsearch*` |
| X04 | Qdrant/Milvus/Weaviate/ChromaDB：集合/维度/Schema、Top-K 检索、请求预览、Upsert、删除及引擎专属参数。 | `components/vector/`、`vector_cmd.rs` |
| X05 | HBase：Namespace、表、Column Family、Row Key/范围扫描、行数据和结构管理；限制大扫描。 | `components/hbase/`、`hbase_cmd.rs` |
| X06 | Pulsar：Tenant/Namespace/Topic、订阅、消息、生产者/消费者、管理策略/权限/配额、监控和 Raw API。 | `components/mq/`、`admin/mq/` |
| X07 | Kafka：Broker/Topic/Partition、Consumer Group、消息读取/发送、配置/监控与实际 capability 门控。 | `components/mq/`、`admin/mq/` |
| X08 | RocketMQ：Topic/Group、消息查询/发送/轨迹、Broker/客户端及适用管理 API。 | `components/mq/`、`admin/mq/` |
| X09 | RabbitMQ：Virtual Host、Exchange/Queue/Binding、消息、连接/Channel、Policy/Permission 与管理 API。 | `components/mq/`、`admin/mq/` |
| X10 | MQTT：Broker 连接、Topic 订阅/发布、消息视图、会话/连接状态及协议参数。 | `components/mqtt/`、`mqtt_cmd.rs` |
| X11 | etcd：Key 前缀搜索/CRUD、Lease/Watch、成员/健康/指标 Dashboard、用户角色 ACL。 | `components/etcd/`、`etcd_cmd.rs` |
| X12 | ZooKeeper：ZNode 树、数据/Stat、创建修改删除、节点 ACL 与连接状态。 | `components/zookeeper/`、`zookeeper_cmd.rs` |
| X13 | Nacos：配置/Namespace/服务/实例、搜索、历史/对比/回滚、批量导入导出/复制、Dashboard 与 Raw API。 | `components/nacos/`、`nacos_cmd.rs` |
| X14 | Consul 概览/能力探测、KV 搜索与 CAS/事务/Watch/导入导出/跨域迁移；保留 64 操作事务限制与分批非原子反馈。 | `components/consul/`、`consul_cmd.rs` |
| X15 | Consul Catalog/Health、Agent Service/Check、Session/Lock、ACL、Enterprise Namespace/Partition、Service Mesh、工具/Operator；敏感值一次展示，危险 Operator 功能分项默认关闭。 | `components/consul/`、`specialized-workspaces.cn.mdx` |
| X16 | DynamoDB、Neo4j、时序/图数据库及仅 browse/understand 的驱动：使用对应对象模型展示查询/记录，不错误套用 SQL 表格或开放未声明写入。 | `plugins/connection-types/`、`database-drivers.manifest.json` |

## 8. 数据库管理、插件、设置与发布

| ID | 任务 / 可验收交付 | DBX 对照 |
| --- | --- | --- |
| P01 | MySQL/PostgreSQL/Xugu 等 Dashboard、进程/会话、SQL Server 活动跟踪及对应数据库专属管理面板。 | `components/admin/` |
| P02 | 用户/角色/权限管理，达梦用户/角色/Job、Oracle DB Link、PostgreSQL 扩展、MySQL Event 等专属对象操作。 | `components/admin/`、`components/objects/` |
| P03 | DBX 插件包 `.dbxp` 的安装/启停/卸载、签名和哈希验证、市场目录、版本/更新、权限隔离、Host API 与插件日志。 | `crates/dbx-plugin-runtime/`、`plugins/` |
| P04 | 插件贡献点：自定义连接/Profile/字段/对象/工作台/侧栏/文件提供者，前端宿主与 sidecar 插件运行时按权限通信。 | `components/plugins/`、`plugin-development.cn.mdx` |
| P05 | 设置：主题/暗色模式、9 种编辑器主题、语言（中/英/西）、快捷键、网格偏好、布局状态和外观资源。 | `components/settings/`、`settingsStore.ts` |
| P06 | 桌面自动更新、变更日志、版本/诊断/支持信息、崩溃或连接错误排查；Web 部署文档与容器构建。 | `host/update.rs`、`components/layout/UpdateDialog.vue`、`deploy/` |
| P07 | 专项系统及各 SQL 方言的用户文档、能力矩阵、快捷键、Web API/CLI/MCP/插件开发文档同步到 Fouc。 | `docs/content/docs/` |
| P08 | Dolt 分支/提交/修订选择、版本差异、表与单元格 diff、分页和版本控制操作；只在 Dolt Profile 启用。 | `components/dolt/` |
| P09 | 对象/Schema 代码快照、差异查看与导出，保持快照来源、时间和目标上下文可追溯。 | `components/codeSnapshot/` |
| P10 | Web 部署的首次初始化、登录安全、容器持久化、反向代理/子路径、1Panel 部署和升级验证；发布 CLI/MCP/桌面安装包与对应平台运行时。 | `crates/dbx-web/`、`deploy/`、`1panel.cn.mdx` |

## 9. 驱动与连接 Profile 覆盖矩阵

下面每个 `Rxx` 都是**独立交付与验收任务**，不是共享连接表单的一次性勾选。列中的运行模式与级别来自 DBX manifest；`operate / understand / browse / connect` 是 DBX 原标记，须以 manifest 逐项能力位、专项 UI 和实际服务端权限作最终验收。`agent` 类型还依赖 C07。Profile 单列在末尾；同一驱动的多个 Profile 必须逐个验证默认字段、图标、连接模板和服务器版本差异。MQ 的四个协议 Profile 在 X06–X09 独立验收。驱动矩阵来源：`opensource/dbx/crates/dbx-core/assets/database-drivers.manifest.json`。

| ID | DBX 驱动类型 | 运行模式 | 支持级别 | 验收范围 |
| --- | --- | --- | --- | --- |
| R01 | `mysql` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, sqlExplain, userAdmin |
| R02 | `postgres` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, sqlExplain, userAdmin |
| R03 | `sqlite` | file | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage |
| R04 | `rqlite` | native | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage |
| R05 | `turso` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage |
| R06 | `cloudflare-d1` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage |
| R07 | `redis` | native | connect | queryExecution |
| R08 | `duckdb` | file | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, driverManagement |
| R09 | `clickhouse` | native | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate |
| R10 | `sqlserver` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, sqlExplain |
| R11 | `mongodb` | agent | connect | queryExecution, objectBrowser, dataTransfer |
| R12 | `dynamodb` | native | operate | metadataBrowse, tableDataEdit |
| R13 | `oracle` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage, sqlExplain, driverManagement |
| R14 | `elasticsearch` | native | connect | queryExecution |
| R15 | `easysearch` | native | connect | queryExecution |
| R16 | `meilisearch` | native | browse | queryExecution, metadataBrowse |
| R17 | `hbase` | native | operate | metadataBrowse, tableDataEdit |
| R18 | `qdrant` | native | browse | queryExecution, metadataBrowse |
| R19 | `chromadb` | native | browse | queryExecution, metadataBrowse |
| R20 | `milvus` | native | browse | queryExecution, metadataBrowse |
| R21 | `weaviate` | native | browse | queryExecution, metadataBrowse |
| R22 | `doris` | native | operate | queryExecution, metadataBrowse, objectBrowser, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, databaseCreate, sqlExplain, userAdmin |
| R23 | `starrocks` | native | operate | queryExecution, metadataBrowse, objectBrowser, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, databaseCreate, userAdmin |
| R24 | `manticoresearch` | native | operate | queryExecution, metadataBrowse, tableDataEdit, tableStructureEdit, sqlFileExecution |
| R25 | `redshift` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, databaseCreate, fieldLineage |
| R26 | `dameng` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage, sqlExplain, driverManagement |
| R27 | `kingbase` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, userAdmin, driverManagement |
| R28 | `highgo` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, userAdmin, driverManagement |
| R29 | `uxdb` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, driverManagement |
| R30 | `vastbase` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, userAdmin, driverManagement |
| R31 | `goldendb` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, userAdmin, driverManagement |
| R32 | `databend` | agent | operate | queryExecution, metadataBrowse, objectBrowser, tableDataEdit, tableStructureEdit, sqlFileExecution, databaseCreate, driverManagement |
| R33 | `gaussdb` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, userAdmin |
| R34 | `kwdb` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, userAdmin |
| R35 | `yashandb` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, databaseCreate, driverManagement |
| R36 | `databricks` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement |
| R37 | `saphana` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement |
| R38 | `teradata` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement |
| R39 | `vertica` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement |
| R40 | `firebird` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement |
| R41 | `exasol` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement |
| R42 | `opengauss` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, userAdmin |
| R43 | `questdb` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, sqlExplain |
| R44 | `oceanbase-oracle` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage, sqlExplain, driverManagement |
| R45 | `gbase` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement |
| R46 | `access` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, driverManagement |
| R47 | `h2` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, dataTransfer, sqlFileExecution, driverManagement |
| R48 | `snowflake` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, databaseCreate, driverManagement |
| R49 | `trino` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, driverManagement |
| R50 | `prestosql` | external | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution |
| R51 | `hive` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, dataTransfer, sqlFileExecution, driverManagement |
| R52 | `argo` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, tableDataEdit, dataTransfer, sqlFileExecution, driverManagement |
| R53 | `kyuubi` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, dataTransfer, sqlFileExecution, sqlExplain, driverManagement |
| R54 | `impala` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, dataTransfer, sqlFileExecution, sqlExplain, driverManagement |
| R55 | `db2` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement |
| R56 | `informix` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement |
| R57 | `neo4j` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, driverManagement |
| R58 | `cassandra` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement |
| R59 | `bigquery` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, driverManagement |
| R60 | `spanner` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, driverManagement |
| R61 | `kylin` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement |
| R62 | `ignite` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement |
| R63 | `ignite3` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement |
| R64 | `sundb` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement |
| R65 | `oscar` | agent | browse | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement |
| R66 | `tdengine` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, databaseCreate, driverManagement |
| R67 | `xugu` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableStructureEdit, tableImport, sqlFileExecution, driverManagement |
| R68 | `etcd` | agent | connect | queryExecution, schemaSearch, driverManagement |
| R69 | `zookeeper` | agent | connect | driverManagement |
| R70 | `nacos` | native | connect | 专项工作台 / 连接能力；按源码验收 |
| R71 | `consul` | native | connect | 专项工作台 / 连接能力；按源码验收 |
| R72 | `mq` | native | connect | metadataBrowse, objectBrowser, driverManagement |
| R73 | `mqtt` | native | connect | 专项工作台 / 连接能力；按源码验收 |
| R74 | `iotdb` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement |
| R75 | `iris` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableStructureEdit, sqlFileExecution, driverManagement |
| R76 | `influxdb` | agent | connect | queryExecution, metadataBrowse, objectBrowser, sqlFileExecution, databaseCreate |
| R77 | `influxdb3` | native | connect | queryExecution, metadataBrowse, objectBrowser, sqlFileExecution |
| R78 | `victoriametrics` | native | browse | queryExecution, metadataBrowse, objectBrowser, sqlFileExecution |
| R79 | `jdbc` | external | browse | queryExecution, metadataBrowse, objectBrowser, sqlFileExecution |
| R80 | `spark` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, dataTransfer, sqlFileExecution, driverManagement |
| R81 | `plugin` | external | connect | 专项工作台 / 连接能力；按源码验收 |

### Profile 逐项验收清单

Profile 来源：`opensource/dbx/plugins/connection-types/profiles/catalog.yaml`。每个 Profile 均须验证 C01/C02 与对应 Rxx/Xxx；兼容协议别名不得遗漏。

| Profile | 对应驱动 | 类别 | 验收状态 |
| --- | --- | --- | --- |
| `mysql` | `mysql` | sql | 待实施 |
| `postgres` | `postgres` | sql | 待实施 |
| `cloudberry` | `postgres` | analytics | 待实施 |
| `opentenbase` | `postgres` | domestic | 待实施 |
| `redis` | `redis` | document | 待实施 |
| `sqlite` | `sqlite` | lightweight | 待实施 |
| `rqlite` | `rqlite` | lightweight | 待实施 |
| `turso` | `turso` | lightweight | 待实施 |
| `cloudflare-d1` | `cloudflare-d1` | lightweight | 待实施 |
| `duckdb` | `duckdb` | lightweight | 待实施 |
| `access` | `access` | lightweight | 待实施 |
| `mongodb` | `mongodb` | document | 待实施 |
| `mongodb-legacy` | `mongodb` | 未标注 | 待实施 |
| `dynamodb` | `dynamodb` | document | 待实施 |
| `clickhouse` | `clickhouse` | analytics | 待实施 |
| `sqlserver` | `sqlserver` | sql | 待实施 |
| `oracle` | `oracle` | sql | 待实施 |
| `elasticsearch` | `elasticsearch` | document | 待实施 |
| `easysearch` | `easysearch` | document | 待实施 |
| `meilisearch` | `meilisearch` | document | 待实施 |
| `hbase` | `hbase` | document | 待实施 |
| `qdrant` | `qdrant` | graph_ai | 待实施 |
| `milvus` | `milvus` | graph_ai | 待实施 |
| `weaviate` | `weaviate` | graph_ai | 待实施 |
| `chromadb` | `chromadb` | graph_ai | 待实施 |
| `mariadb` | `mysql` | sql | 待实施 |
| `tidb` | `mysql` | domestic | 待实施 |
| `oceanbase` | `mysql` | domestic | 待实施 |
| `oceanbase-oracle` | `oceanbase-oracle` | 未标注 | 待实施 |
| `goldendb` | `goldendb` | domestic | 待实施 |
| `databend` | `databend` | analytics | 待实施 |
| `tdsql` | `mysql` | domestic | 待实施 |
| `polardb` | `mysql` | domestic | 待实施 |
| `greatsql` | `mysql` | domestic | 待实施 |
| `databricks` | `databricks` | analytics | 待实施 |
| `saphana` | `saphana` | analytics | 待实施 |
| `teradata` | `teradata` | analytics | 待实施 |
| `vertica` | `vertica` | analytics | 待实施 |
| `firebird` | `firebird` | sql | 待实施 |
| `exasol` | `exasol` | analytics | 待实施 |
| `gbase` | `gbase` | domestic | 待实施 |
| `gbase8a` | `gbase` | 未标注 | 待实施 |
| `gbase8s` | `gbase` | 未标注 | 待实施 |
| `opengauss` | `opengauss` | domestic | 待实施 |
| `gaussdb` | `gaussdb` | domestic | 待实施 |
| `kwdb` | `kwdb` | domestic | 待实施 |
| `questdb` | `questdb` | timeseries | 待实施 |
| `kingbase` | `kingbase` | domestic | 待实施 |
| `highgo` | `highgo` | domestic | 待实施 |
| `uxdb` | `uxdb` | domestic | 待实施 |
| `yashandb` | `yashandb` | domestic | 待实施 |
| `vastbase` | `vastbase` | domestic | 待实施 |
| `doris` | `mysql` | analytics | 待实施 |
| `selectdb` | `mysql` | analytics | 待实施 |
| `starrocks` | `mysql` | analytics | 待实施 |
| `manticoresearch` | `manticoresearch` | document | 待实施 |
| `redshift` | `redshift` | analytics | 待实施 |
| `cockroachdb` | `postgres` | sql | 待实施 |
| `dm` | `dameng` | domestic | 待实施 |
| `h2` | `h2` | lightweight | 待实施 |
| `h2-legacy` | `h2` | 未标注 | 待实施 |
| `snowflake` | `snowflake` | analytics | 待实施 |
| `trino` | `trino` | analytics | 待实施 |
| `prestosql` | `prestosql` | analytics | 待实施 |
| `hive` | `hive` | analytics | 待实施 |
| `kyuubi` | `kyuubi` | analytics | 待实施 |
| `argo` | `argo` | domestic | 待实施 |
| `impala` | `impala` | analytics | 待实施 |
| `spark` | `spark` | analytics | 待实施 |
| `db2` | `db2` | sql | 待实施 |
| `informix` | `informix` | sql | 待实施 |
| `dremio` | `jdbc` | analytics | 待实施 |
| `jdbcx` | `jdbc` | sql | 待实施 |
| `neo4j` | `neo4j` | graph_ai | 待实施 |
| `cassandra` | `cassandra` | document | 待实施 |
| `bigquery` | `bigquery` | analytics | 待实施 |
| `spanner` | `spanner` | sql | 待实施 |
| `kylin` | `kylin` | analytics | 待实施 |
| `ignite` | `ignite` | analytics | 待实施 |
| `ignite3` | `ignite3` | analytics | 待实施 |
| `sundb` | `sundb` | domestic | 待实施 |
| `oscar` | `oscar` | domestic | 待实施 |
| `jdbc` | `jdbc` | 未标注 | 待实施 |
| `tdengine` | `tdengine` | timeseries | 待实施 |
| `xugu` | `xugu` | domestic | 待实施 |
| `iotdb` | `iotdb` | timeseries | 待实施 |
| `etcd` | `etcd` | registry_config | 待实施 |
| `etcd-v2` | `etcd` | 未标注 | 待实施 |
| `zookeeper` | `zookeeper` | registry_config | 待实施 |
| `mq` | `mq` | mq | 待实施 |
| `kafka` | `mq` | mq | 待实施 |
| `rocketmq` | `mq` | mq | 待实施 |
| `rabbitmq` | `mq` | mq | 待实施 |
| `nacos` | `nacos` | registry_config | 待实施 |
| `consul` | `consul` | registry_config | 待实施 |
| `mqtt` | `mqtt` | mq | 待实施 |
| `iris` | `iris` | sql | 待实施 |
| `cache` | `iris` | sql | 待实施 |
| `influxdb` | `influxdb` | timeseries | 待实施 |
| `influxdb3` | `influxdb3` | timeseries | 待实施 |
| `victoriametrics` | `victoriametrics` | timeseries | 待实施 |
| `custom_mysql` | `mysql` | sql | 待实施 |
| `dolt` | `mysql` | sql | 待实施 |
| `custom_postgres` | `postgres` | sql | 待实施 |

## 10. 收尾核验

- [ ] F00 将本文件各行转换为可追踪任务；每行提交 PR/测试/截图或录屏证据，并记录 DBX 版本差异。
- [ ] 81 个 R 任务与 104 个 Profile 全部有真实连接验收记录；能力位为 true 的功能逐项通过，false 的操作不会错误显示。
- [ ] 桌面、Web、CLI、MCP 四入口的共享能力行为一致；平台专属能力有明确边界和提示。
- [ ] 只读、生产确认、Agent 执行和 MCP 权限不能被任意入口绕过；失败和取消可恢复。
- [ ] 导入/导出/备份/传输在大数据量、编码错误、网络中断和部分失败下通过回归。
- [ ] Fouc 公共组件与最终 MySQL 工作台 UX 保持一致；专项界面保留 DBX 功能且符合 Fouc 视觉系统。
- [ ] 文档与实际能力矩阵同步；所有功能任务实施后按仓库流程测试、提交，桌面版构建产物刷新。
