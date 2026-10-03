# Fouc 数据存储模块设计

> 状态：目标设计；已实现范围以代码及测试为准，MySQL 能力不代表所有数据源均已交付。
>
> 适用范围：Fouc V1 及后续数据存储能力演进
>
> 参考基线：Fouc Connector 架构、`opensource/dbx` commit `f909f85075e12beb78dffe5942f7d039bede25de`（2026-09-20）
>
> 关联文档：[Connector 整体架构](./connector-architecture.md)

## 结论

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
- **Provider 不是驱动。** Provider 是用户和 Agent 可见的能力与治理边界；Driver 是 Provider 内部的连接实现；Instance 是某个工作空间保存的一条连接。个人凭据仍可由用户持有，访问与执行必须另行授权。
- **dbx 应作为产品行为和测试语料来源，而不是作为第二个应用嵌入 Fouc。** Fouc 不引入 dbx 的 Rust/Tauri 业务层，不运行一套平行控制面，也不复制其单体前端；应按 Fouc 的 Next.js + TypeScript sidecar 边界重写核心能力。
- **设备侧数据源驱动与 Fouc 业务数据库保持独立。** PostgreSQL 驱动可在 `backend/device/src/database/drivers/postgres.ts` 使用 `pg`，只消费用户显式提交的数据源配置，不读取 Fouc 业务服务的 `DATABASE_URL`，不导入服务端数据库、账户或租户表。连接配置与会话按 `workspaceId` 隔离，密码只在当前连接请求中使用，不能混入配置文件；后续持久凭据统一接入 Credential Broker。
- **SQL 历史由设备保存，并绑定原连接与执行目标。** MySQL / PostgreSQL / SQLite 的用户 SQL 通过只读策略后，记录实际成功或驱动失败、完整提交内容、数据库 / Schema、耗时和结果数量；被策略拦截的内容不记录为执行历史。已保存连接的历史进入当前工作空间独立 SQLite 文件，每空间保留最新 1000 条；直接打开的临时会话只使用内存，断开后清除。历史保存失败不改变成功查询的结果，以独立警告反馈；查询失败仍保留原驱动错误。删除连接同步清理其历史和 SQL 库，断开或删除后的迟到查询结果不得重新写入历史。
- **历史分页与恢复保留原始内容。** 时间与 ID 共同组成稳定游标；列表只取前 600 个字符的预览，详情按需读取完整 SQL。搜索按字面匹配 SQL / 目标 / 错误，支持状态、Schema 和日期；数据库条件以连接 ID + 数据库共同限定，不能因同名数据库跨连接命中。工作台当前展示本连接历史，分页追加去重、筛选后重置、撤销旧请求，失败保留旧结果并可重试。历史恢复替换当前标签编辑内容与目标上下文，修改内容需要确认；不会自动执行。新查询触发历史更新时回到首页，不能沿用旧分页游标。PostgreSQL / SQLite 目标数据库不匹配、Schema 不可用或表格尚有待提交变更而恢复需要切换 Schema 时，拒绝恢复并在窗口中说明原因；跨连接筛选 UI、多目标执行与取消仍待推进。
- **SQL 库是设备侧连接资源，不执行 SQL。** 文件夹支持嵌套、名称检查、移动、循环阻断与确认后的递归删除；文档保存完整 SQL 与数据库 / Schema，列表只读取名称、字节数、打开次数和时间，正文按需加载。文件名补全 `.sql`，同连接 / 数据库 / 文件夹的名称不区分大小写；改名或移动不会覆盖未提交的正文，更新全部相关标签的元数据并保留草稿。打开文件创建或复用对应标签；复用时正文已变化且有本地修改，先确认保留或替换。删除文件保留相关标签正文并解除文件绑定。文件保存和删除在 SQLite 事务内检查版本，变化时要求重新打开核对，禁止静默覆盖。工作台支持 Ctrl/⌘+S、另存为、历史收藏、复制完整内容、搜索、最近 / 常用排序及文件顺序调整；已有文件允许保存空正文，新建空查询不开放文件保存。当前单文档 UTF-8 正文上限 64 MiB，执行范围另受查询策略约束；外部文件导入 / 大文件流式加载、snippet / 格式化、跨数据库文件树未完成。设备 SQL 库不导入业务数据库实现，不因登录状态切换数据来源。
- **SQL 标签与草稿属于当前设备、工作空间和保存的连接。** 标签独立保留数据库 / Schema、SQL、文件基线和版本、选区 / 滚动位置及结果视图；固定、拖动、重命名、复制、前后访问、批量关闭确认与当前工作台内最近 20 个关闭标签恢复均操作同一状态。SQL 新建不替换现有文档，执行和结果按发起标签 ID 归属，多个标签的异步请求互不覆盖；执行中的标签不能关闭或返回连接列表。CodeMirror 撤销 / 折叠等完整 EditorState 留在当前工作台内存，重连后恢复 SQL / 选区 / 滚动；首次隐藏挂载后须在可见测量时恢复滚动，窄屏切换须露出当前标签。设备 SQLite 只保存白名单草稿，不存执行锁和本次结果；完整快照上限 64 MiB。300 ms 防抖串行保存，返回先刷新所有在途编辑，失败保留工作台；内部卸载仍提交并在本窗口保留失败状态，浏览器关闭前有待保存内容时请求原生提醒。页面卸载的大于 60 KiB 请求无法保证完成，应在离开前确认保存完成。不同窗口使用版本检查，冲突后可查看完整设备 SQL，等待全部查询结束后显式替换或保留双方文档合并保存，避免旧请求迟到污染恢复后的结果；合并时冲突的本地副本解除文件绑定，防止覆盖原文件。干净文件标签重连后读取最新文件内容与目标，脏标签保留旧文件版本和完整草稿，远端更新将由文件 CAS 拒绝覆盖；文件已删除时保留 SQL 并解除绑定。未保存连接只保留当前工作台内存草稿。删除连接同步清理设备草稿，缺失连接的迟到请求不能重建。编辑器分组 / 分屏 / 独立窗口、外部文件监测、结果磁盘缓存与其他驱动 / 入口仍未完成。
- **SQL 补全按当前目标懒加载，不改变执行权限。** 每个工作台会话独立缓存表 / 视图与被当前语句引用对象的字段，表与字段读取共享最多四路并发；仅通过设备侧当前工作空间和会话读取原生元数据，不执行用户 SQL、不创建历史或写入授权、不保存到草稿。当前覆盖 MySQL / PostgreSQL / SQLite 的实际 Schema / 数据库、限定对象、别名、当前语句和父级子查询作用域，内部别名遮蔽父级且不引入兄弟查询字段；CTE 链、嵌套 WITH、显式输出列表、星号顺序和多层派生表输出已参与补全；物理表的显式 Schema 不受同名 CTE 遮蔽。未引用 CTE 不查询，CTE 和非 LATERAL 派生体隔离外部字段，LATERAL 仅引用前面同级对象。纯字段投影保留实际类型 / 注释 / 来源，表达式类型保持未知；结果别名按各方言的 WHERE / GROUP BY / HAVING / ORDER BY 可见规则提示。共享词法保留全局 UTF-16 偏移，优先复用 CodeMirror Statement 窗口，Pg dollar 文本 / 嵌套注释回退原生词法。推导深度最多八层，CTE 语句 / 单体推导限制20000 / 5000 token，超限保留已知名称，不宣称支持完整大文件语义。递归锚点 / 声明输出有界，Pg DISTINCT ON / MATERIALIZED 有原生验收。歧义字段插入别名或完整 Schema / 表限定名；原生 UTF-8 标识符按 Pg ASCII 折叠 / 引用精确、MySQL 表与 CTE 名称精确 / 字段大小写宽容、SQLite ASCII 比较分别处理；SQLite 元数据目标采用原始名称，避免大小写宽容的 SQL 引用变成错误接口目标。按方言转义引号与特殊名称，字符串 / 注释内不查询，别名点号后不显示关键字。目标变化关闭浮层，工作台刷新 / 手动刷新撤销旧读取并增加 epoch，旧响应与旧标签浮层不能复活；缓存失败可重试，错误明确显示且保留 SQL 和可用编辑能力。候选显示真实字段类型 / 来源 / 注释，浅深主题和窄屏沿用工作台令牌。CodeMirror 提示挂到当前 Fouc overlay 宿主（Web回落body），缓存视图重绑当前宿主，浮层不受编辑器 / 状态栏 / 结果区裁切；窄屏同时验证视口边界和实际中心 / 角点遮挡，不能只检查 DOM 几何范围。复杂递归 / 相关输出来源、USING / NATURAL 星号合并、表函数 / 外键 JOIN / snippets / 参数、完整语义诊断 / 方言模式、大文件性能及其他入口仍待实现和验收。
- **Redis 数据源与业务缓存保持独立。** 设备驱动使用用户显式提供的地址、ACL 用户、数据库编号与 TLS 配置，不读取业务服务的 Redis 环境变量。会话中的数据库编号不可通过命令台更改；Key/值保留原始 Base64 字节，扫描游标以十进制字符串传输，Stream 游标保留完整消息 ID。当前 Standalone 已有读取、有界受控写入、数据库切换、字段期限、命令历史、运行概览、慢日志、Stream 消费组 / 消费者 / Pending 观测、实时 MONITOR、Pub/Sub 和 RedisJSON 完整文档编辑；Sentinel/Cluster 与完整版本 / 入口矩阵仍须推进。Redis `COUNT` 是批次提示，集合扫描不得截掉返回项造成下一页缺失；后续 Result Store 与虚拟列表须覆盖大集合和大 keyspace。
- **Stream 观测保持服务端原始语义。** `XINFO GROUPS / CONSUMERS` 与有界 `XPENDING` 只读取当前空间的当前会话，不确认、认领或投递消息，不产生命令历史或写入授权。名称保留二进制 / 空字节串，计数与消息 ID 两段均保留 64 位精度；`entries-read`、Lag、Inactive 缺失或未知时显示未知。Pending 按服务端消费者过滤，每页 100 条，沿用 DBX 的包含游标加预读策略：仅当首条恰为游标才去重，游标被 ACK 后不能跳过其后继。元数据响应限制 2 MiB，超出限制或权限 / 类型 / 消费组错误应明确失败，不能显示假空列表。组 / 消费者切换会撤销旧读取；刷新保留仍存在的选择，消失后返回相应列表并说明，失败保留上次数据并提供重试。Idle / Inactive 的版本语义依 [Redis XINFO CONSUMERS](https://redis.io/docs/latest/commands/xinfo-consumers/)，不把未提供的 Inactive 推断为零。
- **MONITOR 是显式运行、可停止的实例观测。** 沿用 DBX 命令台的独立 MONITOR 入口，只匹配单个 `MONITOR`（可带一个末尾分号）；普通命令策略不因此开放任意脚本或管理命令。设备会话复制独立监听连接，通过带 Bearer 鉴权的当前空间 HTTP NDJSON 流返回结果，不通过全局广播、不持久化监控内容。初始化超时 10 秒；停止、流取消、视图卸载、会话断开或数据库切换均释放监听连接，迟到确认不能恢复已取消的任务，意外断开显示错误并保留已收记录。前端保留最新 1000 条，每条最多 16 KiB，保留原始微秒时间与 Redis 字节转义；设备待发送缓冲同时限制 1000 条 / 2 MiB，以 100 ms 批次发送，压力丢弃和行截断明确提示。当前只适用于已支持的 Standalone 直连；界面必须说明 MONITOR 监听整个实例的所有 DB、[会降低吞吐](https://redis.io/docs/latest/commands/monitor/)，不把当前 DB 选择显示成服务器侧过滤。
- **Pub/Sub 使用独立订阅连接，发布使用当前普通会话。** 订阅 / 模式订阅及取消必须等待 Redis 确认，逐项保存已确认的状态；同一批次后续名称被 ACL 拒绝时，先前成功项仍可读取，不能显示整批成功或假空列表。设备以 Node `net` / `tls` 和 RESP2 字节解析建立连接，继承当前地址、凭据、DB 与严格 TLS 验证，避免 ioredis 将模式名称转成文本；频道、模式、消息和空名称保留原始 Base64 字节。鉴权的空间 / 会话 HTTP NDJSON 流只面向当前请求，订阅变更同时绑定捕获 ID；不保存消息和发布历史。订阅初始化及确认超时 10 秒，HTTP 取消（含确认前）、视图卸载、DB 切换、会话关闭和连接异常均释放连接。重新连接按上次已确认名称恢复，失败可移除名称后重试；每次连接有独立捕获 ID，不混淆重置后的消息序号。依 [Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/)，频道跨 DB 共享，频道与模式同时匹配会产生两条投递，断开期间的消息不会补发。
- **Pub/Sub 的读取和发布边界明确可见。** 每批订阅变更 1–100 个名称，每个最多 64 KiB，单连接最多 1024 个订阅 / 2 MiB 名称；设备待发送与前端保留均最多 500 条 / 2 MiB，单个观测值保留前 64 KiB，并显示原始字节长度、截断和传输缓冲丢弃。前端提供筛选、JSON / 原始 Base64 复制、消息详情、跟随、清空、断开和订阅恢复。发布要求当前会话已解锁写入（现有授权流程需要 Redis 7+），频道最多 64 KiB、消息最多 1 MiB，支持零字节消息；先预览完整字节，再明确确认，不通过通用命令台开放 `PUBLISH`。返回整数作为“Redis 接收计数”，保留精度，依 [PUBLISH](https://redis.io/docs/latest/commands/publish/) 不解释成消费者处理完成。投递后响应丢失时显示结果未确认并禁止在同一预览直接重试，不自动重发。当前验证为 Redis 7.4 Standalone，其他版本 / 拓扑与入口仍待验收。
- **“移植所有核心能力”指目标能力完整，不代表首个版本一次支持 dbx 的 81 个连接类型。** 第一阶段以约 5 万行实质核心逻辑迁移为目标，优先建立 MySQL、PostgreSQL、SQLite、Redis 四种常用数据源的完整能力，再扩展 etcd、MongoDB 与兼容 profiles。行数是规模门槛，不能替代逐功能、逐驱动的真实验收；样例界面、目录元数据、样式、测试和参考源码不计入这一核心逻辑门槛。
- **RedisJSON 保留完整文档和原始数值词法。** 类型识别覆盖 `JSON` / `ReJSON-RL`；读取使用 `JSON.GET key .` 的旧式根路径，依 [JSON.GET](https://redis.io/docs/latest/commands/json.get/) 返回文档本身，避免 `$` 将根数组再包进匹配数组。文档 `null` 与 Key 消失不同；无效 UTF-8 / JSON、超过 2 MiB 完整读取范围均明确失败，不显示截断后的假 JSON。`MEMORY USAGE` 为可选预检查，权限不足仍尝试完整读取并检查响应大小。`COMMAND INFO JSON.GET JSON.SET` 区分可用、缺失和未知，不要求 `MODULE LIST`；元数据被拒绝或损坏时保持未知，实际读写权限由命令决定。
- **RedisJSON 编辑沿用现有写入计划。** 文档格式化 / 压缩与 Unicode 显示直接处理 JSON token，保留大整数、重复字段、顺序和未修改转义，不经过 JavaScript Number。Unicode 显示中的修改映射回原始转义，差异算法有规模上限及替代路径；编辑器提供折叠、搜索、撤销 / 重做、自动换行、复制和丢弃草稿。草稿修改时阻止 Key / DB / 视图 / 返回 / 刷新 / 重新锁定导航，先保存或丢弃。写入最多 1 MiB，解锁后预览完整 `JSON.SET key $ document NX|XX` 参数，再明确确认；沿用完整 DUMP / 绝对过期时间冲突检查、ACL 预检查、一次性计划和重新锁定撤销，不产生命令历史。根替换保留 Key TTL；模块缺失时新建 JSON 禁止预览，未知元数据允许尝试并显示实际错误。Redis 自身可规范化浮点、转义与重复字段，原始请求保持词法不表示服务端按原文存储。当前真实验证为 Redis 8.2.2 / ReJSON 8.2.1，Redis 7.4 无模块场景验证缺失反馈；其他模块版本 / 拓扑与全入口仍待验收。

- **工作台视觉与功能同时验收。** 以固定 DBX 源码的 `docs/screenshot-light.png`、`docs/screenshot-grid.png`、资源树与编辑器组件为布局参考，保留紧凑资源树、文档标签、编辑器 / 结果分区和表格工作面；统一消费 Fouc 的浅色 / 深色、前景、边界和交互令牌。正文与资源行以 13 px 为最低默认字号，SQL 以 14 px 为最低默认字号，并尊重更大的外观偏好；主命令、当前标签、对象类型和保存状态形成清晰层级。资源树区分表 / 视图与实际数量，长名称使用省略和完整提示；连接信息可关闭，窄屏按侧面板显示。SQL 操作工具栏在窄屏保留有名称的图标按钮与独立目标选择行，保存状态放在编辑器状态栏，全部关闭后仍可见。结果区具有加载 / 空 / 错误状态、可局部横向滚动的视图标签与独立统计 / 导出栏。编辑器 / 结果分隔线支持指针和键盘，当前工作台内保持比例；高度变化时滚动位置受新视口的实际可滚动范围约束，不能将正常范围裁切误判为丢失草稿。视觉回归必须检查真实内容、控件、字体基线、浅深主题与窄屏状态，不用空界面截图代替验收；AI、其他专项工作面及全部主题 / 视口矩阵仍逐项推进。

这个方案与现有 Connector 文档的“一平台一 Provider、多 Instance”“通用控制面、独立数据适配器”一致，同时避免每个数据库连接器重复建设一个数据库客户端。

## 目标与非目标

### 目标

- 在 Fouc 内提供现代化的数据连接、浏览、查询、编辑、管理和诊断体验；
- 将数据存储变成 Work Room、Agent、Automation 和 Project 可受控使用的上下文与工具；
- 覆盖 SQL、Key-Value、文档、搜索/分析、向量、配置中心等不同数据模型；
- 复用统一的凭据、连接、权限、审批、审计、执行位置和结果裁剪机制；
- 桌面端可连接本机与内网数据源，Web 端可通过在线桌面或客户 Relay 使用；
- 逐步达到 dbx 的核心工作台能力，同时保持 Fouc 的架构和视觉语言一致；
- 为后续数据分析、数据质量、数据迁移、知识上下文和自动化触发建立稳定底座。

### 非目标

- 不在 V1 一次性追平 dbx 所有数据库和管理功能；
- 不把 Fouc 变成 dbx 的换皮版本；
- 不把 dbx 的 Rust 业务代码放入 `src-tauri/`；
- 不用一个 `execute(command: string)` 能力绕过 Connector 的 schema、策略和审计；
- 不允许模型直接获得数据库密码、完整连接串、SSH 私钥或不受限的大结果集；
- 不把所有数据源抹平成最低公分母 CRUD；
- 不在仅有少数内置 Provider 时提前建设第三方驱动市场和不受控的动态插件运行时。

## 为什么是多个 Provider，而不是一个 Provider

### 判断标准

一个数据源是否应成为独立 Provider，按以下顺序判断：

| 判断项 | 相同时 | 不同时 |
| --- | --- | --- |
| 协议与认证 | 可复用 Provider profile | 倾向独立 Provider |
| 资源模型 | 可复用工作面 | 独立 Provider 或独立 surface |
| 危险操作语义 | 可复用风险分类 | 必须独立能力契约 |
| 配置结构 | profile 覆盖默认值 | 独立 Provider |
| 驱动仅是实现差异 | 保持同一 Provider | 不因驱动不同拆分 |
| 用户心智与品牌 | profile/label | 若权限和能力独立则拆分 |

### 推荐归属

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

### 三层身份必须分开

```text
ProviderDefinition          DriverDescriptor             ConnectorInstance
mysql                      mysql2/native                生产订单库
用户/Agent 可见            内部实现细节                  用户实际连接
能力、风险、配置 schema     协议、包、运行时、版本         地址、范围、凭据引用、状态
```

不要把 Driver 列表直接当 Connector Catalog，也不要为每个连接 Instance 复制 Provider Definition。

## 总体架构

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

### 放置原则

- `backend/`：全部业务逻辑、驱动编排、策略、查询、结果处理、AI 工具投影；
- `shared/`：Provider/Instance/Capability DTO、Data Store contracts、分页与事件契约；
- `src/`：Catalog、Provider 详情、多 Instance 管理、共享 Data Store Workbench 和 Agent 协作 UI；
- `src-tauri/`：仅提供 OS Vault、文件选择、窗口、进程看护等薄桥，不放数据库业务；
- 长尾 JDBC/Agent 若采用独立进程，业务策略仍在 TypeScript sidecar，子进程只实现窄驱动协议。

### 建议代码组织

```text
backend/device/src/connectors/
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

## 声明式 Provider 与 Profile

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

### 能力矩阵

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

## 连接、凭据和执行位置

### Instance 配置

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

密码、Token、客户端私钥、证书私钥、SSH 密码和 key passphrase 必须进入 Credential Broker，Instance 只保存 `credentialRef`。连接 URL 需要在解析时拆出 secret，禁止将含密码的原始 URL 回写到普通 SQLite 或日志。实例数据与查询历史均按 `workspaceId` 隔离；设备本机凭据不能替代服务端的空间授权。

### 传输层

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

### 连接状态

除 Connector 通用状态外，运行时还要管理：

- idle / opening / ready / busy / closing / failed；
- pool 或 single session；
- reconnect generation，避免旧请求落到新会话；
- query execution id、取消句柄和 transaction session；
- driver/product/version/database identity；
- capability negotiation 结果。

连接测试必须返回服务端确认的信息，而不是仅做 TCP 探测。成功结果至少包含产品名、版本、当前 database、驱动名与版本；Redis/etcd 返回各自可确认的集群信息。

## Capability 设计

### 通用能力

```text
datastore.connection.test
datastore.connection.open
datastore.connection.close
datastore.metadata.refresh
datastore.resource.search
datastore.result.export
```

### SQL Provider 能力

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

### Redis Provider 能力

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

### etcd Provider 能力

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

### 为什么不能只有 `execute`

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

## 核心功能范围

### P0：可用的共享 Workbench

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

表数据查询明确区分两个执行范围。数据库筛选与排序使用共享的结构化条件树，设备驱动按真实字段元数据验证列名、操作符和值类型，生成带参数绑定的 WHERE / ORDER BY；不得拼接用户输入作为 SQL。嵌套 AND/OR、含 NULL 的列表、区间与多列排序均由数据库执行，应用或重置时回到第一页。排序补充缺失的主键字段以确定相同值之间的顺序；没有主键时提示分页顺序可能变化，主键排序也不承诺不同请求之间的快照一致。

当前页搜索只处理已读取的行，并保留原始行索引供详情与编辑使用；搜索结果的可见位置不能作为写入目标。界面显示查询的执行位置，支持条件草稿、SQL / 绑定参数预览、NULL 排序位置与每页行数。存在暂存写入时阻止改变筛选、排序或分页；提交或放弃后再重新查询。当前结果的值过滤与本地排序是独立能力，不与数据库条件混用。

结构浏览独立于表行读取，按字段、索引、外键、约束、触发器和 DDL 分页签展示真实目录。复合键保持字段顺序，PostgreSQL 表达式键与 INCLUDE 列、MySQL 前缀 / 方向 / 可见性、SQLite 辅助索引键分别保留；外键跳转仍限制在当前连接与工作空间，暂存写入时禁止跳转。目录未提供的事实返回未知，不从空值猜测支持。SQLite 的 CHECK、声明约束名、部分索引条件与延期属性以原始 DDL 为准，PRAGMA 外键编号不能充当声明名。

DDL 使用只读编辑器，允许复制与下载。MySQL / SQLite 展示数据库原文；PostgreSQL 依据目录重建字段、Identity / 生成字段、约束、索引、触发器和注释，并明确标示来源与未包含的存储选项、权限、所有权和外部依赖。结构查看脚本不能等同于数据库备份，创建 / 修改 / 删除与 SQLite 重建必须另经变更计划和确认入口验收。

Redis 独立会话默认只读，解锁仅作用于当前设备会话，不持久化为配置、不授予命令台任意写入。当前 Standalone 写入入口需要 Redis 7+ 的脚本权限检查，以及快照 / 元数据和对应变更命令权限；旧版本继续按实际可用能力读取，其他入口与版本的写入仍须单独验收。String、List、Set、Hash、ZSet、Stream 的创建与编辑、删除、Key 重命名和 TTL 通过同一预览 / 确认入口执行。Key、字段、成员、值均保留原始字节；文本与 Base64 切换不得改变字节，完整字符串编辑另行读取，不能把 64 KiB 浏览片段当成完整值写回。

编辑版本由设备会话持有，绑定 Key 的完整 DUMP 与绝对过期时间，读取前后不一致时不开放编辑；预览与提交再次检查版本、类型、目标重名及权限。计划五分钟内有效且只消费一次，重新锁定或断开立即撤销已生成和正在生成的版本 / 计划。当前有界编辑范围为约 1 MiB 的 Key 内存与序列化内容、List 索引 0–9999，超限仍可读取但必须明确显示编辑限制；大 Key 编辑和批量变更是后续独立能力。

普通内容编辑保留 Key 过期时间，Hash 编辑在 Redis 7.4+ 可用时保留原字段的毫秒期限；所需权限不足时不能忽略失败。相对 TTL 从确认执行时起算，绝对时间使用客户端所选本地时间转换后的时间戳，永久表示 PERSIST。重命名不覆盖目标，List 按索引删除采用碰撞检查后的独立标记。Redis Lua 本身不回滚：多步变更先检查全部命令与 RESTORE 权限，遇到执行错误恢复原始快照；补偿或连接结果未确认时显示明确错误，要求刷新核对，不自动重试。

Redis 数据库切换先建立独立客户端并明确等待 SELECT 成功确认，成功后替换会话、撤销旧计划并重新锁定写入；切换失败保留原来的已验证连接。不能仅依据客户端 ready 事件认定 SELECT 成功，也不能修改正在处理其他请求的客户端 DB。保存配置中的默认 DB 不因工作台切换而改变。数据库目录读取 CONFIG 与 INFO Keyspace，配置数量未知时只列出实际观察到的 DB，数量不可读时显示未知并允许手工编号验证；目录每页最多 128 项。旧会话关闭幂等，仍存在的其他空间会话不得被关闭。

Hash 分页保留字段的 HPTTL 毫秒值，旧版本或读取权限不足时显示未知与原因，不推断为永久。Redis 7.4+ 的字段期限修改通过同一变更计划执行，支持相对期限、绝对时间与 HPERSIST，保留 Key 的期限，拒绝缺失字段和权限不足。

命令历史只记录通过只读规则并实际尝试执行的命令；被规则拦截的 AUTH / SET 等输入不得持久化。历史绑定工作空间与保存的连接，保留准确的执行 DB、时间、成功 / 失败和最多 16 KiB 的输出，截断明确标示；每个连接最多保存最近 100 条，当前 DB 与本连接所有 DB 可分别查看、召回、重用与复制。保存连接的历史位于当前设备，断开重连后仍可读取；未保存的直接会话历史只留在内存。清空覆盖本连接所有 DB，删除连接同时释放所属会话并清除历史。完整查询历史、搜索、收藏与其他入口按独立能力推进。

运行概览按 DBX 的 INFO 分区、指标卡片、搜索 / 复制和折叠交互适配，读取当前已验证连接的 INFO ALL；计数和命中率计算保留 64 位精度，缺失字段显示未知。全实例 Key、客户端和命令统计包含所有 DB，不能标作仅当前 DB 的指标。自动刷新提供关闭及 5 / 10 / 30 / 60 秒选项，请求顺序执行，页面隐藏时暂停，离开视图或替换会话时释放计时器并取消 HTTP 读取；刷新失败明确标记并保留上次数据，重试成功后解除错误。未知模块分区与冒号值保留，INFO 超过 2 MiB 时显示限制，不把部分分区当作完整概览。

慢日志读取当前实例的 SLOWLOG GET，接受 1–10000 条查询，ID / Unix 秒 / 微秒耗时使用十进制字符串，命令参数保留独立字节和 Base64，支持数值排序、筛选、每页 100 行和详情 / JSON 复制。日志属于整个实例，耗时只表示服务器执行时间；Redis 可能截断参数，已记录命令不能自动当作完整原始命令重放。旧版本未提供的客户端字段和新版本原始参数总数显示未提供。SLOWLOG LEN 或 CONFIG GET 不可用时保留实际日志、将总数 / 阈值 / 容量标为未知；SLOWLOG GET 或 INFO 权限拒绝显示读取失败，不能伪造空结果。慢日志序列化响应有 2 MiB 上限，省略数量明确提示；页面读取不改变日志配置、不重置日志、不写入命令历史。CONFIG、LEN 和日志读取非同一瞬间的快照，日志总数与本次返回条数可不同。当前单节点路径已验收，集群逐节点概览和日志仍属于 Cluster 能力。

### P1：专业管理能力

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

### P2：跨数据源与 Agent-Native 能力

- 跨连接数据迁移、断点续传、校验与失败恢复；
- 字段血缘、数据质量检查、敏感字段识别；
- 自动化触发：定时查询、阈值告警、Schema 变化、Redis/etcd Watch；
- 将查询结果物化为 Work Room artifact、报告、图表或可复用数据集；
- Project/Work Room 级数据源授权与可复用上下文；
- 客户 Relay 与团队共享服务身份；
- 长尾 SQL/分析数据库 driver process；
- 连接模板与企业策略下发。

## AI 协作与 AI+ 设计

Fouc 的优势不是在 dbx 的 AI 面板上再套一层聊天，而是让数据能力进入统一 Agent 工作流。

### Agent 可见工具

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

### 上下文装配

Agent 默认只获得：

- Instance 的显示名、Provider、允许范围与能力；
- 目标 database/schema/table 的最小 metadata；
- 用户明确选择的对象、SQL、结果切片或错误；
- 来源引用、采集时间和是否截断。

默认限制建议：列表 200 个对象，采样 20 行，普通查询 50 行，可请求上限 1,000 行；字符串单元格默认 200 字符、显式窗口最大 4,000 字符。大结果进入本地 Result Store，Agent 只读摘要和分页窗口。

这些数字参考 dbx 当前 Agent 工具的边界，最终应通过 Fouc 实测调整并成为可配置策略。

### 写入闭环

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

直接行编辑采用相同的预览 / 提交原则：连接会话默认只读，用户先解锁表格写入；SQL 查询入口继续执行只读策略。服务端持有不可修改的变更计划，绑定工作空间、会话、Schema、表、字段结构快照和五分钟有效期；提交入口只接受计划 ID 和明确确认，不接受替换 SQL 或参数。计划在执行前消费，锁定写入和断开连接撤销未提交计划。每批最多 100 项变更，全部在一个数据库事务中执行；逐行锁定并核对读取时的完整原始行，冲突或约束失败使整批回滚。首批修改 / 删除要求主键或非空单列唯一键，计算字段不能直接赋值，MySQL 仅接受 InnoDB 表。无键行保护、长任务取消、未知提交结果核查，以及 Agent / CLI / MCP 的统一 Approval Grant 仍须按各自入口扩展，不能将此 UI 计划直接视为已完成全产品授权。

### AI+ 场景

- 自然语言生成 SQL/Redis 查询/etcd 筛选；
- 解释慢查询、错误、执行计划和 Schema；
- 根据业务问题自动选择表、生成查询并产出图表/报告；
- 对两个环境做 Schema/Data Diff 并生成变更方案；
- 数据质量诊断与异常归因；
- 把查询证据附着到任务、报告和决策记录；
- 自动化中执行只读检查，达到条件后通知或创建工作项；
- 对变更只生成 proposal，由人审批后执行。

## 安全与治理

### 三层权限

每个 Instance 和细分 scope 使用统一模式：

| 模式 | 允许 | 默认审批 |
| --- | --- | --- |
| `read_only` | metadata、读取、estimated explain | 无或策略决定 |
| `safe_write` | 有明确范围的 DML/KV 修改 | 每次或策略决定 |
| `high_risk_write` | DDL、删除、flush、权限、维护 | 必须显式审批 |

权限可在 workspace → group → instance → database/schema/key-prefix 逐层收窄。V1 不需要实现所有层级 UI，但数据模型不能只存一个 `readOnly: boolean`。

### 强制防线

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

### Invocation 扩展

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

## 数据模型

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

## 前端体验与信息架构

### 一个产品入口、两级详情状态

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

### 共享 Workbench 框架

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

### 从 dbx 借鉴但不复制的 UI 原则

- 保留其紧凑的专业工具密度、可调整面板、标签页、多结果与专用浏览器；
- 沿用 Fouc 的颜色、排版、动效和 Work Room 交互语言；
- 拆分可测试的 feature 组件，不形成单个全局 `App` 或万能 store；
- Server state、tab state、editor state、result state、connection runtime state 分开；
- 大型 Grid 和编辑器按需加载，专用 surface 懒加载。

## API 与事件

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

## Provider Adapter 契约

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

## 首批 Provider 的具体范围

### MySQL

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

### Redis

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

### etcd

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

## 测试与验收策略

### 契约测试

每个 Provider 必须通过同一套：

- descriptor/schema 校验；
- secret redaction；
- connect/test/health/disconnect；
- timeout/cancel/reconnect generation；
- capability negotiation；
- policy/approval/audit；
- 错误归一化；
- 结果分页、截断与引用。

### 数据源测试矩阵

使用版本固定的容器配方验证：

- MySQL：正常/TLS/只读账号/锁等待/大结果/取消/跨库引用；
- PostgreSQL：Schema 隔离、只读事务、游标截断、大整数/精确数值、复合主键、重复列名、生成列与权限；
- SQLite：已有文件的只读打开、单连接、生成列与主键、文件锁、整数精度、查询取消与文件备份；
- Redis：standalone/Sentinel/Cluster、所有数据类型、过期、二进制值、大 keyspace；
- etcd：TLS/auth、revision/watch/lease、compact 后历史、权限拒绝；
- 网络：离线、DNS、代理、证书、半开连接、sidecar 重启。

### 安全回归

- SQL 风险语料库，包括注释、CTE、多语句、方言语法、存储过程和动态 SQL；
- Redis command 风险表与参数级规则；
- approval 目标/内容篡改、过期、重放和跨 Instance 使用；
- secret 日志扫描；
- prompt injection 数据语料；
- 行/字节/时间/并发限制；
- 生产 scope 的跨 database/schema/prefix 绕过。

dbx 的测试文件可作为行为清单和语料参考，但 Fouc 应建立自己的 TypeScript 契约测试，不把 dbx 测试运行结果当作 Fouc 的验收结果。

## 开源代码使用与归属

`opensource/dbx` 使用 Apache License 2.0。Fouc 可以参考并在满足许可证义务的前提下改写或复用代码，但实施时必须：

- 记录实际复制或派生的文件、commit 和改动；
- 保留适用的版权、许可证与 NOTICE；
- 不把“看过实现后重新设计”与“直接复制代码”混为一谈；
- 优先复用行为、测试语料和领域知识，避免机械翻译 Rust/Vue 单体结构；
- 对图标、第三方驱动和各依赖分别核对许可证，不能只依赖 dbx 根许可证；
- 在首次实质代码移植前增加 `THIRD_PARTY_NOTICES` 或等价归属文件。

本文是架构分析，不构成法律意见。
