# Fouc 数据存储模块设计

> 状态：目标设计；已实现范围以代码及测试为准，MySQL 能力不代表所有数据源均已交付。
>
> 适用范围：Fouc V1 及后续数据存储能力演进
>
> 参考基线：Fouc Connector 架构、`opensource/dbx` commit `f909f85075e12beb78dffe5942f7d039bede25de`（2026-09-20）
>
> 关联文档：[Connector 整体架构](./connector-architecture.md)

## 结论

SQL 编辑器的格式化采用已移植的 DBX AST 排版层，MySQL / PostgreSQL / SQLite 保留原生字面量、注释、参数及 PostgreSQL 相邻字符串的换行语义。格式化与压缩优先处理选区，一次编辑可撤销；异步结果仅应用到仍保持原状态的视图。保存时格式化使用完整文档快照，后续输入不能被较早结果覆盖。设置与代码片段归当前设备和连接，设备保存连接偏好以版本比较写入；临时连接只留在会话内，断开清理。版本冲突保留编辑并显式读取、选择设备版本。DBX 的十一种通用片段支持补全、字段跳转、启停及自定义编辑，格式化不改变 SQL 执行权限。

原生三种 SQL 方言已有函数字段补全、当前参数提示、函数悬停和原生参考链接；别名 / CTE 诊断与定义导航只使用当前语句的已知语义，不把尚未加载的表字段报成错误。快速操作提供限定字段、展开已知投影、文本引用、注释、IN 列表与表查询生成，修改当前文档并可单次撤销。异步应用核对视图、原始文档和选区，焦点 / 提示状态变化不误拒绝编辑。浏览器读取与下载 SQL 文件支持 UTF-8、带 BOM 的 UTF-16 及显式 GB18030，拒绝无效编码，原始内容进入当前连接的独立标签；打开不执行。文件与完整草稿各受 64 MiB 上限约束，预览显示截取范围。超过 128,000 字符的文档跳过补全、诊断和函数辅助扫描；单次执行仍最多 1 MiB，可选择大文件中的较短语句，变量上下文只传已有声明。流式脚本执行、ZIP 与任务恢复属于后续独立用例。

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
- **Provider 不是驱动。** Provider 是用户和 Agent 可见的能力与治理边界；Driver 是 Provider 内部的连接实现；Instance 是用户保存的一条连接。个人凭据仍可由用户持有，访问与执行必须另行授权。
- **dbx 应作为产品行为和测试语料来源，而不是作为第二个应用嵌入 Fouc。** Fouc 不引入 dbx 的 Rust/Tauri 业务层，不运行一套平行控制面，也不复制其单体前端；应按 Fouc 的 Next.js + TypeScript sidecar 边界重写核心能力。
- **设备侧数据源驱动与 Fouc 业务数据库保持独立。** PostgreSQL 驱动可在 `backend/device/src/database/drivers/postgres.ts` 使用 `pg`，只消费用户显式提交的数据源配置，不读取 Fouc 业务服务的 `DATABASE_URL`，不导入服务端数据库、账户或业务资源表。连接配置属于设备；会话按 `sessionId` 与 `connectionId` 校验归属，密码只在当前连接请求中使用，不能混入配置文件；后续持久凭据统一接入 Credential Broker。
- **设备资源不以产品工作空间分区。** 关系型、Redis 与 Mongo 连接目录分别保存在各 Provider 的 `connections.json`；SQL 历史、SQL 文库、草稿与编辑器设置共用设备 `sql-library.sqlite`，按连接 ID 及真实目标限定读取和更新；数据库文档笔记共用设备 `database-docs.sqlite`，按连接 ID 与数据库限定。Redis 历史按连接 ID 保存。所有设备接口经同一设备认证边界进入；原生读取、写入计划、执行、流和导出文件继续绑定有效 `sessionId`，MCP 继续使用明确的 `connectionId` 授权。连接全局可用不放宽原生账号权限，也不把关联项目引用变成数据库权限。
- **SQL 历史由设备保存，并绑定原连接与执行目标。** MySQL / PostgreSQL / SQLite 的用户 SQL 通过只读策略后，记录实际成功或驱动失败、完整提交内容、数据库 / Schema、耗时和结果数量；被策略拦截的内容不记录为执行历史。已保存连接的历史进入当前设备 SQLite 文件，设备保留最新 1000 条；直接打开的临时会话只使用内存，断开后清除。历史保存失败不改变成功查询的结果，以独立警告反馈；查询失败仍保留原驱动错误。删除连接同步清理其历史和 SQL 库，断开或删除后的迟到查询结果不得重新写入历史。
- **历史分页与恢复保留原始内容。** 时间与 ID 共同组成稳定游标；列表只取前 600 个字符的预览，详情按需读取完整 SQL。搜索按字面匹配 SQL / 目标 / 错误，支持状态、Schema 和日期；数据库条件以连接 ID + 数据库共同限定，不能因同名数据库跨连接命中。工作台当前展示本连接历史，分页追加去重、筛选后重置、撤销旧请求，失败保留旧结果并可重试。历史恢复替换当前标签编辑内容与目标上下文，修改内容需要确认；不会自动执行。新查询触发历史更新时回到首页，不能沿用旧分页游标。PostgreSQL / SQLite 目标数据库不匹配、Schema 不可用或表格尚有待提交变更而恢复需要切换 Schema 时，拒绝恢复并在窗口中说明原因；跨连接筛选 UI 与跨连接目标组执行仍待推进。
- **SQL 库是设备侧连接资源，不执行 SQL。** 文件夹支持嵌套、名称检查、移动、循环阻断与确认后的递归删除；文档保存完整 SQL 与数据库 / Schema，列表只读取名称、字节数、打开次数和时间，正文按需加载。文件名补全 `.sql`，同连接 / 数据库 / 文件夹的名称不区分大小写；改名或移动不会覆盖未提交的正文，更新全部相关标签的元数据并保留草稿。打开文件创建或复用对应标签；复用时正文已变化且有本地修改，先确认保留或替换。删除文件保留相关标签正文并解除文件绑定。文件保存和删除在 SQLite 事务内检查版本，变化时要求重新打开核对，禁止静默覆盖。工作台支持 Ctrl/⌘+S、另存为、历史收藏、复制完整内容、搜索、最近 / 常用排序及文件顺序调整；已有文件允许保存空正文，新建空查询不开放文件保存。当前单文档 UTF-8 正文上限 64 MiB，执行范围另受查询策略约束；外部文件导入 / 大文件流式加载、snippet / 格式化、跨数据库文件树未完成。设备 SQL 库不导入业务数据库实现，不因登录状态切换数据来源。
- **SQL 标签与草稿属于当前设备和保存的连接。** 标签独立保留数据库 / Schema、SQL、文件基线和版本、选区 / 滚动位置及结果视图；固定、拖动、重命名、复制、前后访问、批量关闭确认与当前工作台内最近 20 个关闭标签恢复均操作同一状态。SQL 新建不替换现有文档，执行和结果按发起标签 ID 归属，多个标签的异步请求互不覆盖；执行中的标签不能关闭或返回连接列表。CodeMirror 撤销 / 折叠等完整 EditorState 留在当前工作台内存，重连后恢复 SQL / 选区 / 滚动；首次隐藏挂载后须在可见测量时恢复滚动，窄屏切换须露出当前标签。设备 SQLite 只保存白名单草稿，不存执行锁和本次结果；完整快照上限 64 MiB。300 ms 防抖串行保存，返回先刷新所有在途编辑，失败保留工作台；内部卸载仍提交并在本窗口保留失败状态，浏览器关闭前有待保存内容时请求原生提醒。页面卸载的大于 60 KiB 请求无法保证完成，应在离开前确认保存完成。不同窗口使用版本检查，冲突后可查看完整设备 SQL，等待全部查询结束后显式替换或保留双方文档合并保存，避免旧请求迟到污染恢复后的结果；合并时冲突的本地副本解除文件绑定，防止覆盖原文件。干净文件标签重连后读取最新文件内容与目标，脏标签保留旧文件版本和完整草稿，远端更新将由文件 CAS 拒绝覆盖；文件已删除时保留 SQL 并解除绑定。未保存连接只保留当前工作台内存草稿。删除连接同步清理设备草稿，缺失连接的迟到请求不能重建。编辑器分组 / 分屏 / 独立窗口、外部文件监测、结果磁盘缓存与其他驱动 / 入口仍未完成。
- **SQL 补全按当前目标懒加载，不改变执行权限。** 每个工作台会话独立缓存表 / 视图与被当前语句引用对象的字段，表与字段读取共享最多四路并发；仅通过设备侧当前连接和会话读取原生元数据，不执行用户 SQL、不创建历史或写入授权、不保存到草稿。当前覆盖 MySQL / PostgreSQL / SQLite 的实际 Schema / 数据库、限定对象、别名、当前语句和父级子查询作用域，内部别名遮蔽父级且不引入兄弟查询字段；CTE 链、嵌套 WITH、显式输出列表、星号顺序和多层派生表输出已参与补全；物理表的显式 Schema 不受同名 CTE 遮蔽。未引用 CTE 不查询，CTE 和非 LATERAL 派生体隔离外部字段，LATERAL 仅引用前面同级对象。纯字段投影保留实际类型 / 注释 / 来源，表达式类型保持未知；结果别名按各方言的 WHERE / GROUP BY / HAVING / ORDER BY 可见规则提示。共享词法保留全局 UTF-16 偏移，优先复用 CodeMirror Statement 窗口，Pg dollar 文本 / 嵌套注释回退原生词法。推导深度最多八层，CTE 语句 / 单体推导限制20000 / 5000 token，超限保留已知名称，不宣称支持完整大文件语义。递归锚点 / 声明输出有界，Pg DISTINCT ON / MATERIALIZED 有原生验收。歧义字段插入别名或完整 Schema / 表限定名；原生 UTF-8 标识符按 Pg ASCII 折叠 / 引用精确、MySQL 表与 CTE 名称精确 / 字段大小写宽容、SQLite ASCII 比较分别处理；SQLite 元数据目标采用原始名称，避免大小写宽容的 SQL 引用变成错误接口目标。按方言转义引号与特殊名称，字符串 / 注释内不查询，别名点号后不显示关键字。目标变化关闭浮层，工作台刷新 / 手动刷新撤销旧读取并增加 epoch，旧响应与旧标签浮层不能复活；缓存失败可重试，错误明确显示且保留 SQL 和可用编辑能力。候选显示真实字段类型 / 来源 / 注释，浅深主题和窄屏沿用工作台令牌。CodeMirror 提示挂到当前 Fouc overlay 宿主（Web回落body），缓存视图重绑当前宿主，浮层不受编辑器 / 状态栏 / 结果区裁切；窄屏同时验证视口边界和实际中心 / 角点遮挡，不能只检查 DOM 几何范围。复杂递归 / 相关输出来源、USING / NATURAL 星号合并、表函数 / 外键 JOIN / snippets / 参数、完整语义诊断 / 方言模式、大文件性能及其他入口仍待实现和验收。
- **Redis 数据源与业务缓存保持独立。** 设备驱动使用用户显式提供的地址、ACL 用户、数据库编号与 TLS 配置，不读取业务服务的 Redis 环境变量。会话中的数据库编号不可通过命令台更改；Key/值保留原始 Base64 字节，扫描游标以十进制字符串传输，Stream 游标保留完整消息 ID。当前 Standalone 已有读取、有界受控写入、数据库切换、字段期限、命令历史、运行概览、慢日志、Stream 消费组 / 消费者 / Pending 观测、实时 MONITOR、Pub/Sub 和 RedisJSON 完整文档编辑；Sentinel/Cluster 与完整版本 / 入口矩阵仍须推进。Redis `COUNT` 是批次提示，集合扫描不得截掉返回项造成下一页缺失；后续 Result Store 与虚拟列表须覆盖大集合和大 keyspace。
- **Stream 观测保持服务端原始语义。** `XINFO GROUPS / CONSUMERS` 与有界 `XPENDING` 只读取当前连接的原生会话，不确认、认领或投递消息，不产生命令历史或写入授权。名称保留二进制 / 空字节串，计数与消息 ID 两段均保留 64 位精度；`entries-read`、Lag、Inactive 缺失或未知时显示未知。Pending 按服务端消费者过滤，每页 100 条，沿用 DBX 的包含游标加预读策略：仅当首条恰为游标才去重，游标被 ACK 后不能跳过其后继。元数据响应限制 2 MiB，超出限制或权限 / 类型 / 消费组错误应明确失败，不能显示假空列表。组 / 消费者切换会撤销旧读取；刷新保留仍存在的选择，消失后返回相应列表并说明，失败保留上次数据并提供重试。Idle / Inactive 的版本语义依 [Redis XINFO CONSUMERS](https://redis.io/docs/latest/commands/xinfo-consumers/)，不把未提供的 Inactive 推断为零。
- **MONITOR 是显式运行、可停止的实例观测。** 沿用 DBX 命令台的独立 MONITOR 入口，只匹配单个 `MONITOR`（可带一个末尾分号）；普通命令策略不因此开放任意脚本或管理命令。设备会话复制独立监听连接，通过带 Bearer 鉴权的当前会话 HTTP NDJSON 流返回结果，不通过全局广播、不持久化监控内容。初始化超时 10 秒；停止、流取消、视图卸载、会话断开或数据库切换均释放监听连接，迟到确认不能恢复已取消的任务，意外断开显示错误并保留已收记录。前端保留最新 1000 条，每条最多 16 KiB，保留原始微秒时间与 Redis 字节转义；设备待发送缓冲同时限制 1000 条 / 2 MiB，以 100 ms 批次发送，压力丢弃和行截断明确提示。当前只适用于已支持的 Standalone 直连；界面必须说明 MONITOR 监听整个实例的所有 DB、[会降低吞吐](https://redis.io/docs/latest/commands/monitor/)，不把当前 DB 选择显示成服务器侧过滤。
- **Pub/Sub 使用独立订阅连接，发布使用当前普通会话。** 订阅 / 模式订阅及取消必须等待 Redis 确认，逐项保存已确认的状态；同一批次后续名称被 ACL 拒绝时，先前成功项仍可读取，不能显示整批成功或假空列表。设备以 Node `net` / `tls` 和 RESP2 字节解析建立连接，继承当前地址、凭据、DB 与严格 TLS 验证，避免 ioredis 将模式名称转成文本；频道、模式、消息和空名称保留原始 Base64 字节。鉴权的会话 HTTP NDJSON 流只面向当前请求，订阅变更同时绑定捕获 ID；不保存消息和发布历史。订阅初始化及确认超时 10 秒，HTTP 取消（含确认前）、视图卸载、DB 切换、会话关闭和连接异常均释放连接。重新连接按上次已确认名称恢复，失败可移除名称后重试；每次连接有独立捕获 ID，不混淆重置后的消息序号。依 [Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/)，频道跨 DB 共享，频道与模式同时匹配会产生两条投递，断开期间的消息不会补发。
- **Pub/Sub 的读取和发布边界明确可见。** 每批订阅变更 1–100 个名称，每个最多 64 KiB，单连接最多 1024 个订阅 / 2 MiB 名称；设备待发送与前端保留均最多 500 条 / 2 MiB，单个观测值保留前 64 KiB，并显示原始字节长度、截断和传输缓冲丢弃。前端提供筛选、JSON / 原始 Base64 复制、消息详情、跟随、清空、断开和订阅恢复。发布要求当前会话已解锁写入（现有授权流程需要 Redis 7+），频道最多 64 KiB、消息最多 1 MiB，支持零字节消息；先预览完整字节，再明确确认，不通过通用命令台开放 `PUBLISH`。返回整数作为“Redis 接收计数”，保留精度，依 [PUBLISH](https://redis.io/docs/latest/commands/publish/) 不解释成消费者处理完成。投递后响应丢失时显示结果未确认并禁止在同一预览直接重试，不自动重发。当前验证为 Redis 7.4 Standalone，其他版本 / 拓扑与入口仍待验收。
- **“移植所有核心能力”指目标能力完整，不代表首个版本一次支持 dbx 的 81 个连接类型。** 第一阶段以约 5 万行实质核心逻辑迁移为目标，优先建立 MySQL、PostgreSQL、SQLite、Redis 四种常用数据源的完整能力，再扩展 etcd、MongoDB 与兼容 profiles。行数是规模门槛，不能替代逐功能、逐驱动的真实验收；样例界面、目录元数据、样式、测试和参考源码不计入这一核心逻辑门槛。
- **RedisJSON 保留完整文档和原始数值词法。** 类型识别覆盖 `JSON` / `ReJSON-RL`；读取使用 `JSON.GET key .` 的旧式根路径，依 [JSON.GET](https://redis.io/docs/latest/commands/json.get/) 返回文档本身，避免 `$` 将根数组再包进匹配数组。文档 `null` 与 Key 消失不同；无效 UTF-8 / JSON、超过 2 MiB 完整读取范围均明确失败，不显示截断后的假 JSON。`MEMORY USAGE` 为可选预检查，权限不足仍尝试完整读取并检查响应大小。`COMMAND INFO JSON.GET JSON.SET` 区分可用、缺失和未知，不要求 `MODULE LIST`；元数据被拒绝或损坏时保持未知，实际读写权限由命令决定。
- **RedisJSON 编辑沿用现有写入计划。** 文档格式化 / 压缩与 Unicode 显示直接处理 JSON token，保留大整数、重复字段、顺序和未修改转义，不经过 JavaScript Number。Unicode 显示中的修改映射回原始转义，差异算法有规模上限及替代路径；编辑器提供折叠、搜索、撤销 / 重做、自动换行、复制和丢弃草稿。草稿修改时阻止 Key / DB / 视图 / 返回 / 刷新 / 重新锁定导航，先保存或丢弃。写入最多 1 MiB，解锁后预览完整 `JSON.SET key $ document NX|XX` 参数，再明确确认；沿用完整 DUMP / 绝对过期时间冲突检查、ACL 预检查、一次性计划和重新锁定撤销，不产生命令历史。根替换保留 Key TTL；模块缺失时新建 JSON 禁止预览，未知元数据允许尝试并显示实际错误。Redis 自身可规范化浮点、转义与重复字段，原始请求保持词法不表示服务端按原文存储。当前真实验证为 Redis 8.2.2 / ReJSON 8.2.1，Redis 7.4 无模块场景验证缺失反馈；其他模块版本 / 拓扑与全入口仍待验收。

- **SQL 参数在共享规则下展开，设备端独立校验。** MySQL / PostgreSQL / SQLite 编辑器识别 `?`、`:name`、`${name}`、`#{name}`、`@name`，支持 Unicode / 点路径键、重复命名参数、独立位置参数、普通字符串内插值，以及 MyBatis `<where>` / `<foreach>` / 索引 / 比较实体。参数支持字符串、数字、布尔值、NULL 与显式原始 SQL；字符串按驱动的实际引用模式转义，数字保留原始十进制文本，数字 / 布尔值 / JSON 集合有输入诊断。JSON 数组中超出安全范围的整数须以字符串提供并选择数字类型。`@set` 仅在语句开头声明原始表达式；当前语句和选区读取文档前缀的声明，不执行上下文中的其他语句。预览、复制与设备编译共享同一实现，设备只接收原始 SQL 和参数值，展开后整批重新通过现有只读预检与驱动隔离。每次最多 128 个参数、32 层模板、展开后 1 MB；原始 SQL 片段生成多语句仍受每批 50 条限制。源映射保留 UTF-16 原始范围，展开区域中的错误指向对应源占位符 / 标签，其他位置保持精确定位。历史 SQL 保存原始模板与必要声明上下文，恢复不自动执行；参数最近值最多八项，仅留在当前会话的查询标签内，关闭标签 / 断开会话即清除。语法开关设置、其他驱动方言与全部模板 / 入口矩阵继续验收。
- **SQL 执行以不可变源范围和会话归属注册。** 当前语句 / 全部语句执行使用三种原生方言的词法范围；非空选区优先，分号仅在顶层拆分，保留 UTF-16 源偏移、注释和引用内容。当前语句在空白行不隐式转为整篇执行。每批 1–50 条、最多 1 MB；完整批次先通过只读策略，再按顺序独立执行和记录历史。每条保留状态、原始 SQL、返回结果与驱动诊断，遇错停止后续语句，成功结果不被错误或取消替换；批次不承诺跨语句统一快照或原子事务。前端提供执行范围、Ctrl/Cmd+Enter、Ctrl/Cmd+Shift+Enter、独立结果标签、进度、耗时与错误定位，切换查询保留结果选择。SQL 已修改时不按旧偏移错误定位，可展开本次原始 SQL。PostgreSQL 定位移除内部游标前缀，并把数据库字符位置转为 UTF-16。
- **取消必须等待驱动真正结束。** MySQL 以独立控制池执行 KILL QUERY，PostgreSQL 以独立控制池执行 pg_cancel_backend；被取消的连接在控制操作结束前不返回普通池，避免迟到取消误伤复用连接。SQLite 查询在只读子进程运行，以终止进程中断阻塞计算，并保持设备 HTTP 循环可用；开发运行时和单文件 sidecar 的内部 argv 分发复用同一逻辑。每会话最多两个并行批次、设备最多八个，设备保留每会话最近四个已结束批次；会话断开先取消并等待注册任务结束，再关闭驱动。工作台先显示停止中，确认驱动返回后显示终态；暂时传输失败保留结果并重试，设备会话 / 记录已释放时明确结果未确认，释放前端锁而不伪报成功或已取消。执行状态按 revision 拉取，未变更时不重复传输完整结果。多目标组、可写 SQL、大文件编码 / 流式执行、磁盘结果存储、软分隔语句 / 存储过程和其他入口仍待推进。

- **执行计划只读取优化器估算。** 当前语句 / 选区使用当前设备的连接、目标 Schema 和模板参数，设备端再次验证单条 SELECT / WITH 与只读策略。MySQL 优先 JSON、确定不支持格式时才回退标准计划；PostgreSQL 使用 ANALYZE FALSE 的 JSON，SQLite 使用 QUERY PLAN。浏览器显示真实节点、图形 / 树 / 摘要 / 原始计划、搜索 / 折叠 / 节点详情、加载 / 重试 / 取消；缺失成本 / 行数明确标为未提供。原生三库实际可生成计划，因此能力注册表达本机真实实现，不改写 DBX 原始能力目录。其他驱动与实际执行 ANALYZE 另行实现。
- **结果网格的选择绑定实际来源。** 查询结果与表页共用虚拟网格，支持矩形 / 稀疏 / 行 / 列选择、键盘移动、原始值详情与复制；首次打开无预选，作用域变化清空，表页搜索保留数据库行号与原始行索引。大整数 / 十进制原文以 BigInt 精确聚合，驱动已失真的不安全数字不参与精确统计。
- **结果导出捕获不可变的已加载快照。** CSV / TSV / JSON / Markdown / 原生 INSERT 提供行列范围、引号 / NULL / 换行 / BOM / 二进制与目标表设置，异步分块、进度 / 取消、最多25行64 KiB实时预览。矩形选区可导出精确行列；稀疏选区复制保持空洞，不能悄悄扩成笛卡尔积导出。实际数值精度、数组 / JSON / 二进制按驱动类型表达，不改变原值或执行导出的 SQL；未加载行、XLSX、ZIP及全库备份继续独立迁移。
- **表数据导入先审查后追加。** CSV / TSV / 自定义分隔、JSON / NDJSON 使用严格编码与逻辑行范围，最多5 MiB、5000行、256列和10万单元格；超限拒绝，不能把截取预览当完整输入。大整数和十进制保留原文，字段映射使用实际目录，缺失值可省略以使用默认值，NULL明确写入，生成字段不能赋值。设备保存不可变输入与字段签名，预览不写入；五分钟一次性计划最多四项、20 MiB，提交重新核对原生会话身份、权限与结构，原生参数绑定分批追加在同一事务内。重新锁定、断开和关闭撤销计划。Excel / INSERT SQL、多文件建表及全表流式导入后续独立迁移。
- **数据比较使用两份已成功结果快照。** 当前连接的查询标签与批次结果可选择左右来源，打开后固定原始内容；显式字段映射和键列区分重复键冲突、缺失与NULL、原始数值、JSON及二进制。差异支持筛选、详情、分页和取消；最多1万行、100万单元格。选择性原生INSERT / UPDATE / DELETE候选保留原值条件，进入新查询标签供审查，不自动执行同步。
- **表结构比较读取当前连接的真实对象。** 参考与目标结构按字段、索引、约束、生成列与原始DDL比较，支持选择、依赖顺序、影响与不支持报告；引用名和字面量不能被空白归一化改变。MySQL完整修改定义、PostgreSQL依赖与SQLite保留行数据/触发器/索引/序列高水位的重建脚本均经过原生P0核对。UI仅复制或下载审查脚本，部署、回滚、OSC及未知外部依赖另经授权用例实现。
- **MongoDB 使用独立原生会话与工作台。** 配置仅保存主机/数据库/认证源/TLS等普通字段，密码仅连接时提供；Canonical EJSON保留BSON类型和64位数值。库、集合、文档筛选/排序/分页、只读聚合、索引和信息读取均为实际驱动，游标及时关闭。写入需显式解锁、设备生成五分钟一次性计划、审查确认；文档以完整原始BSON及类型条件原子比较，禁止rekey/upsert，部分投影和view/time-series不能编辑。创建/删除集合和索引单独预检；外部DDL竞争不能假定事务保障。锁定/断开撤销计划。GridFS使用原生桶/文件/EJSON目录与lazy只读流，1GiB下载上限、关闭会话取消流，附件保留原始字节和安全文件名；目录不完整及非法长度明确告警。Web无流式保存能力时64MiB回退；上传/删除、dump和文档导入导出另行迁移。
- **网格布局与显示格式独立于原值。** 列隐藏/NULL列隐藏、左右冻结、拖拽排序与宽度、自动适宽、字体密度，以及日期/时区/JSON路径/掩码/模板保存在连接、数据库 / Schema、表或查询标签作用域。重新执行保留布局，选区则绑定实际结果页；复制、统计、导出仍取原值，隐藏与排序按源索引映射，不能把格式字符串写回数据库。转置和自动刷新尚未迁移。
- **结构编辑基于真实完整元数据。** 三库字段、主键和索引草稿由设备生成DDL、影响与不支持项；计划绑定原生会话、权限与当前结构指纹，提交重新读取，过期或锁定立即失效。MySQL逐步隐式提交显示partial且不伪称回滚；PostgreSQL事务提交和网络未确认明确区分；SQLite仅执行支持的ADD/索引，重建等变化生成手工提示。外键/完整约束/存储选项后续迁移。
- **元数据探索共用授权原生会话。** 对象目录、精确Pg OID/重载、字段搜索、ER图和文档均使用当前 connection/session/database/schema 的真实目录；搜索/图有并发与范围限制，缺失权限和不完整覆盖明确提示。ER关系只来自实际外键，生成JOIN在新SQL标签审查，不自动执行。文档本地Markdown笔记/彩色分组独立于原生注释，设备SQLite按 connection/database 精确定位，CAS防覆盖，删除连接同步清理。DBML不能表示的结构逐项告警。
- **跨引擎追加与网格批量草稿均明确提交边界。** 网格批量编辑复用单一草稿历史、源行/类型校验，显示草稿不改变原始复制/导出，提交后清空历史。传输源独立只读分页、目标单事务追加，设备一次性计划绑定两端结构指纹和权限；取消等待回滚结果，网络结果不确定不会自动重试。当前未提供建表、清表或断点恢复。
- **图表使用当前已加载结果。** 动态ECharts按稳定查询作用域保存配置，原始数字文本精确聚合后才转换绘图坐标；不可安全表示的值明确诊断，AVG近似标记。分类/系列上限、NULL、分组和排序只影响图形，复制与导出仍保留原值。
- **网络连接使用唯一公开配置与临时秘密输入。** MySQL/Pg/Redis/Mongo共用connectionOptions，TLS默认关闭、开启后同时验证证书与主机名；CA/客户端证书/key/passphrase只进入设备进程内存，保存need-reupload标记不落PEM。URL/libpq DSN解析可反填普通字段，Mongo多主机/SRV/topology按当前schema保留；保存配置不包含密码/URI，连接请求仅白名单password/options。旧开发ssl/tls字段直接拒绝，不留兼容分支。
- **SQL变更预览与执行保持两阶段。** 原生三库只支持已能证明影响的单表确定性INSERT VALUES/UPDATE赋值/DELETE WHERE，预览只读SELECT/COUNT并展示未知默认/生成值；隐藏触发器/级联/权限/未覆盖语法拒绝实际计划。解锁/锁定/断开撤销计划，提交再次核对结构/目标原行与WHERE范围，在同一事务锁和真实权限下执行；取消等待回滚，COMMIT应答丢失明确unknown、不自动重试。
- **全表导出由设备原生读取并暂存。** SQL/CSV/JSON/NDJSON多表导出包含实际类型与范围，分页缓冲有界，PK精确游标或offset；当前独立只读分页不承诺一致快照。ZIP STORE/CRC和完整语句分包保留原值，临时文件单任务1GiB、同一会话所有导出共1GiB、设备所有会话共2GiB，完成后经鉴权流式下载。关闭面板继续后台任务并可恢复；会话关闭/取消/清理等待流关闭后删除文件，结果JSON不暴露artifact路径。备份/依赖/序列状态与额外格式继续独立实现。
- **公开连接文件与当前设备连接目录匹配。** 原生配置JSON导出排除密码、PEM、URI和内部资源ID，保留需重传标记；整个输入完整校验后逐条原生CRUD，同名默认改名/跳过或明示原ID更新。可选PBKDF2-SHA256 600000次与AES-256-GCM加密，严格认证格式/版本和随机salt/IV；取消只停止后续写入，真实逐项报告部分成功。
- **所有数据存储共用 A1 连接目录。** SQLite、MySQL、PostgreSQL、Redis、MongoDB 使用同一 `connection-list` 视图；类型差异在 provider 描述与行模型转换处收敛，不各自复制列表。当前视觉基准为 [A1 连接列表](assets/data-storage-connection-list-a1.png)：搜索 260×30、项目 / 标签筛选最小宽85px、高30px，选中数量以计数显示、独立“仅收藏”复选框、34px 表头与48px数据行。列为连接名称、文件 / 连接目标、关联项目、标签、登录账户（网络类型）、认证库（仅 MongoDB）、状态和操作，另有选择列；不展示最近使用或默认访问。网络目标展示主机端口与数据库，Redis 使用 DB 编号；SQLite 仅展示文件名，hover / 键盘焦点提示完整路径，右侧按钮复制绝对路径并反馈结果。正文最低13px并尊重外观字号，主题沿用 Fouc 令牌；窄屏在表格区域横向滚动。排序、筛选、分页、列显示和选择均实际生效；所选连接可通过右上角菜单导出公开配置，或通过底部工具坞批量追加标签、删除配置与测试连接；工具坞操作按钮统一 28px，使用全局 hover / 危险背景令牌。操作逐条执行并报告进度及每条失败原因，离开当前目录后停止后续请求。批量标签保留各连接原有标签，统一校验数量与长度后开始保存；批量删除明确列出目标并确认，不删除数据库内容。测试使用本次输入的密码与证书，关闭临时会话；已验证的秘密只在当前设备进程中按连接 ID 与完整公开配置绑定复用，不持久化。配置改变、连接删除或重连失败时清除；设备进程重启后需重新输入。
- **目录整理与原生配置、项目授权分开。** `directory` 保存收藏、最多20个项目ID引用与12个标签（每个最多32字符），三类设备连接仓储共用字段白名单与连接 ID 精确定位的 PATCH。连接目录只读展示项目引用，点击可跳转当前身份有权访问的对应项目首页；不提供关联项目编辑或复制连接，关联控制归项目侧用例。标签管理使用独立弹窗，只 PATCH 标签字段。项目与标签筛选均可多选，同组取并集、不同组取交集；筛选菜单不重复显示标题。连接名称仅展示，不提供重复详情弹窗；测试通过时点击打开直接重新建立原生会话并进入工作台，不显示额外打开弹窗。未测试或失败时点击打开进入编辑弹窗，测试中禁用入口；已通过但凭证缺失或重连失败时也回到编辑并显示原因。保存当前已测试的表单时再验证已保存目标，将测试状态与临时凭证绑定到实际连接。项目名称由 `features/project` 当前可访问的真实项目目录解析；无权限、已删除或暂不可用的项目不以旧名称或演示数据补齐，也不提供跳转。设备仅持久化连接的整理信息，不访问业务数据库、不授予项目成员原生数据库权限，也不把它宣称为云端项目资源绑定。普通配置编辑保留目录，公开配置导出仍不包含项目引用、标签或收藏。
- **目录列宽与轻量反馈保持稳定。** 除固定选择列和最末操作列右边缘外，表头列间支持拖动调整列宽，也支持方向键微调；其它内容列保持原宽度，最末操作列吸收剩余空间。表格至少铺满内容区，内容超出容器时横向滚动，取消手势恢复原布局。列宽按数据库类型保存于本机浏览器偏好，各类型独立。无关联项目使用内容宽度标签；收藏立即切换星形，保存失败恢复原状态并提示，不闪现禁用指针或动画。更多菜单展开时入口持续高亮，菜单项消费全局普通 / 危险状态色。
- **原生权限与防误操作保护分开。** 不增加 Fouc 数据库角色、授权表或连接访问模式；数据库账户决定原生读写能力，Fouc 保留会话与连接归属保护及写入审查。会话初始只读与显式解锁仅用于防误操作，解锁不提升数据库账户权限，重连恢复保护。目录删除“默认访问”列：MySQL / PostgreSQL / Redis / MongoDB 展示配置中的登录账户，Redis 空用户名展示原生 default 账户，MongoDB 单独展示认证库；SQLite 依赖设备文件权限，无账户列。目录账户不是 Fouc 登录身份，也不推断当前有效权限。
- **状态列只描述实际连接验证。** 保存配置不会自动探测连接；未验证显示“未测试”。已保存连接的测试与打开工作台经同一原生连接入口，结果仅持久化 `passed/failed` 与时间，不持久化异常文本、密码或证书；临时测试会关闭其会话。状态提示说明这是上次验证而非当前在线状态。测试操作显示旋转图标，结果紧邻测试按钮，详细版本或失败原因通过 tooltip 展示；修改表单即清除旧反馈。连接参数变化清除旧结果；异步完成时核对当前目标，已删除或修改的配置不被旧结果恢复或污染。
- **测试数据复用实际导入计划。** 种子可重复、逐字段类型与NULL概率、默认/生成字段保护，BIGINT/DECIMAL保持原始文本；最多5000行/5MiB/100000cells。预览不写入，明确解锁后经同一TableImportPlans完整服务端审查与一次事务确认。FK不假定引用存在，必填未能生成时阻断；唯一值只保证生成样本，不承诺现有表没有冲突。
- **二进制详情保留原始字节。** HEX/ASCII每页1024B，前256KiB预览与搜索，UTF8有效性明确；栅格图像按原生头部与2400万像素预算识别，禁用活动SVG/HTML，原始文件和图像最多16MiB。浮动详情挂入统一overlay宿主以避免缩小结果区与窄屏裁切；复制原值与下载字节不受查看格式改动。
- **原生监控采用真实可读目录。** MySQL/Pg状态和进程使用固定只读SQL，按服务器权限显示缺失指标；SQLite仅呈现PRAGMA，不假造进程。当前页面可暂停/手动刷新，后台隐藏跳过轮询，趋势有界且请求单飞。
- **Mongo文件保持BSON语义。** Canonical EJSON/JSON/NDJSON完整输入、typed JSONPointer与ID策略在只读审查阶段校验，确认后逐批ordered append并报告实际partial/unknown；流导出明确有界且不承诺跨游标快照。
- **SQL文件先解析再复用导入。** 仅接受明确方言的字面量INSERT与显式列，整个文件审核后进入实际目标字段映射；不执行源文件脚本，BIGINT/DECIMAL保留文本，所有提交仍归原生TableImportPlans。
- **创建数据库或Schema也必须审查。** MySQL创建数据库，Pg仅在当前数据库创建Schema。原生目录/字符集/角色权限先读取，完整DDL经只读preview→unlock→explicit confirm；计划绑定当前Entry且单次消费，重新锁定/断开撤销。MySQL隐式提交与响应丢失显示unknown，避免重复创建。
- **CLI以明确连接进入设备能力。** `pnpm datastore:cli`默认只读，支持关系型库表/查询/文档及Redis/Mongo只读页；临时建立的会话在成功/失败/取消后关闭，显式connect的会话由调用者关闭。注册SQL支持取消与超时；精确JSON/CSV及文件overwrite边界不放宽实际设备权限。口令只从环境读取。
- **结果固定与转置复用精确结果。** 固定结果有界保存不可变原始快照，重跑不会覆盖；转置与复制保留NULL、空字符串与原始大数，不转换为浮点数。
- **Redis批量限定明确keys。** DUMP与绝对到期时间构成只读计划，解锁后重新审查；原生ACL与所有CAS先检查后一次EVAL。Lua运行时异常可能部分成功，报告实际状态，不声称事务回滚。
- **建表使用受控结构DTO。** 原生目录/权限检查后生成完整CREATE TABLE，字段顺序、主键、自增/Identity与默认值遵循当前方言。未实现的计算列、外键、CHECK与分区不生成空壳DDL。
- **Mongo表格导入保持精确类型。** CSV/TSV完整解析复用公开table-import词法；采样只能建议映射，用户明确确认列、JSONPointer和BSON类型后复用原生审核/append。
- **MCP采用标准协议且默认只读。** `pnpm datastore:mcp`默认stdio，HTTP只在显式配置Token/Host/Origin后绑定127.0.0.1；每个客户端拥有固定会话与捕获结果，关闭时取消并清理。Schema/表范围不能约束任意SQL，SQL工具仅在整个连接被授予时开启；所有工具固定授权连接、独占会话与真实设备能力。MCP强制仅按授权的精确连接ID解析，删除后必须失败，不能采用CLI的唯一名称回退；固定会话不接受浏览器会话借用。HTTP默认端口8712，不随dev:all自动启用。
- **SQLite备份使用原生快照。** 独立worker从当前会话的源文件执行只读transaction与backup，包含已提交WAL并校验独立文件；目标仅为受控owned artifact，鉴权下载/取消/关闭均等待worker和流退出后清理。当前不提供恢复，浏览器保存不允许选择源文件同名目标。
- **索引和外键从真实目录进入受控DDL审查。** 索引支持三库原生有序复合键、唯一性及明确支持的方言选项；外键支持MySQL/Pg实际字段类型、引用唯一键与复合列顺序检查，SQLite未实现重建路径时明确禁用。只读计划绑定当前Entry、目录指纹和五分钟有效期，明确解锁后重新审查并一次性提交；MySQL隐式DDL可能留下原生索引或未确认结果，如实反馈且不自动重试。界面按生命周期hook、字段设计器和危险操作审查拆分。
- **JOIN补全只使用真实外键。** 当前SQL语义块与别名决定候选，双向复合关系生成完整ON或合法USING；引用目录按连接、会话和刷新版本隔离，并发与缓存有界，取消后不写入旧候选。
- **清空表明确区分三库语义。** 仅允许原生普通表，准备阶段只读行数、权限、入向外键和触发器；入向外键阻断，不提供CASCADE或关闭约束。MySQL使用TRUNCATE并明确确认自增重置及隐式提交，Pg使用ONLY CONTINUE IDENTITY RESTRICT并在同一锁定事务内复核，SQLite使用DELETE且保留序列并确认触发器。每次写权限切换都撤销旧计划，最终确认绑定完整schema.table和一次性计划。
- **账户、事件与扩展目录遵循原生可见范围。** MySQL/Pg账户、角色成员关系和可见权限只读；不读取口令hash，不将角色路径冒充完整有效权限。MySQL事件展示真实调度、时区、状态与原生定义；Pg扩展展示已安装/可用版本、安装要求和依赖成员，重建说明仅为元数据而非完整扩展恢复脚本。目录缺失权限或属性时明确标示未知，SQLite不展示不适用能力。
- **表浏览工作面采用 DBX 紧凑布局。** 保留 Fouc 顶栏与主导航，连接页头高 40 px；浅色主题下资源侧栏和工作对象标签栏默认背景为白色，激活标签使用浅灰背景；深色主题保留原背景。资源工具栏高 32 px，提供刷新、全部折叠和收纳侧栏，收纳后资源侧栏完全隐藏，不保留窄栏；展开入口移到连接页头。搜索框右侧提供定位当前对象与排序 / 筛选菜单；定位清除搜索遮挡并展开、滚动到当前表或视图，筛选按表 / 视图类型，排序按原生目录顺序或名称升降序，不扩展数据库读取范围。数据库资源树采用 32 px 行高并提供表、视图及字段 / 索引 / 外键 / 触发器入口。工作对象标签栏高 32 px，当前对象以 `table@schema` 标签呈现；每个标签为包含图标、标题和关闭按钮的整体容器，内容垂直居中；标签 hover / 键盘反馈覆盖整体，右侧只保留关闭按钮，SQL 标签可显示一个草稿或执行状态点；标签管理操作通过右键菜单访问，不额外放置更多按钮；页头、标签栏右侧和表工具栏命令使用共享浅色圆角容器，默认 / hover / 展开底色由共享操作状态管理。激活与非激活仅以主题背景色区分，不带下划线；SQL 查询标签直接复用工作对象标签栏，不另设内层标签栏。Schema 对象、关系图、数据库文档和活动监控在资源侧栏提供常驻入口；标签栏右侧始终提供「工作台视图」菜单，包含数据浏览和 SQL 查询，窄屏隐藏资源侧栏后仍可切换。打开的专项视图拥有独立可关闭标签；关闭 SQL 视图须等待设备草稿保存，正在执行的查询阻止关闭，重开保留查询标签与结果。查询结果的图表仍由结果区「图表」入口提供。连接信息与完整数据库位置收进页头信息按钮的 340 px 下拉弹窗；连接身份与状态、完整路径、驱动 / 版本分别分区，选中数据行时以独立双列区域显示行详情；支持外部点击、Escape 和关闭按钮，不挤占数据表宽度。元信息与字段筛选 / 跳转列 / 表属性同处一行，WHERE / ORDER BY 与刷新、行编辑、提交 / 回滚同处下一行。导入与原生导出归资源侧栏，当前页导出、分页与真实请求耗时归底栏。显示命令通过布局插槽组合，仍由原有功能组件持有查询、暂存、审查和弹窗状态；不复制设备会话或写入逻辑。默认表格使用 14 px 界面字体、28 px 数据行、44 px 类型表头、主键 / 唯一键图标及交替行底色，保留已保存的用户布局。当前完成表浏览静态还原及入口接线；DBX 的 SQL 条件输入、树元数据展开和各专项弹窗的逐项行为对齐独立验收。
- **数据表选区右键菜单复用当前能力。** 在原有选区内右击只移动当前单元格焦点，保留多选；在选区外右击选择新目标，Shift+F10可由键盘打开。菜单采用共享compact密度：196px宽、26px行高、13px中等字重、加粗图标、明确边界及接触阴影；就地出现，不使用长入场动画。菜单提供数据库与当前页升降序、参数绑定筛选、相同值 / 所选行 / 所选列高亮与清除、所选多行相同原值列隐藏及显示恢复、单元格 / 原生列结构 / 行详情、原始值复制、转置、清除、选区PNG、CSV / TSV / JSON / Markdown / SQL导出、文本 / JSON / 原生二进制只读查看及刷新。高亮限当前结果，不影响选区、暂存反馈或复制；更换结果后不复用旧行位置。相同列比较至少两行并保留原始类型，隐藏仍复用现有列布局且至少保留一列。JSON查看用原始token格式化，避免JS数字解析舍入；非JSON / 二进制值的对应打开项禁用。当前页排序保留精确数字文本，并把行索引映回当前已加载原始页；复制与图片不读取未选中值。写入项遵循当前会话、表类型、字段和行标识限制；批量赋值、NULL及UUID / 时间 / 序列生成先进入逐单元格预览，克隆与删除所选行只进入可撤销的待提交列表，保存沿用原生SQL审查与一次性计划。克隆省略主键 / 生成字段，新增草稿可逐条编辑；不可定位的行禁止删除，批次仍使用现有50行 / 100项变更 / 1MB限制。菜单使用统一主题与危险操作反馈，锚点挂到当前浮层宿主并限制在视口内，小窗口子菜单覆盖父菜单显示以避免越界；不新增设备权限或数据库执行路径。
- **工作台视觉与功能同时验收。** 以固定 DBX 源码的 `docs/screenshot-light.png`、`docs/screenshot-grid.png`、资源树与编辑器组件为布局参考，保留紧凑资源树、文档标签、编辑器 / 结果分区和表格工作面；统一消费 Fouc 的浅色 / 深色、前景、边界和交互令牌。正文与资源行以 13 px 为最低默认字号，SQL 以 14 px 为最低默认字号，并尊重更大的外观偏好；主命令、当前标签、对象类型和保存状态形成清晰层级。资源树区分表 / 视图与实际数量，长名称使用省略和完整提示；连接信息可关闭，窄屏保持下拉弹窗并限制在视口内。SQL 操作工具栏在窄屏保留有名称的图标按钮与独立目标选择行，保存状态放在编辑器状态栏，全部关闭后仍可见。结果区具有加载 / 空 / 错误状态、可局部横向滚动的视图标签与独立统计 / 导出栏。编辑器 / 结果分隔线支持指针和键盘，当前工作台内保持比例；高度变化时滚动位置受新视口的实际可滚动范围约束，不能将正常范围裁切误判为丢失草稿。视觉回归必须检查真实内容、控件、字体基线、浅深主题与窄屏状态，不用空界面截图代替验收；AI、其他专项工作面及全部主题 / 视口矩阵仍逐项推进。

- **选区整体反馈优先。** 选中单元格使用明显的浅蓝填充、浅色内部网格和主题前景色的2px连续外框，填充与网格随主题面板色混合；多选内部活动单元格不重复描边，单选使用相同边框。滚动容器不显示焦点高亮外框。Ctrl 排除后的空洞与不连续选区按真实相邻关系绘制边界；活动单元格仍承载键盘导航、详情和右键目标，不改变复制与操作范围。

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

密码、Token、客户端私钥、证书私钥、SSH 密码和 key passphrase 必须进入 Credential Broker，Instance 只保存 `credentialRef`。连接 URL 需要在解析时拆出 secret，禁止将含密码的原始 URL 回写到普通 SQLite 或日志。实例数据与查询历史绑定设备及保存的连接；设备本机凭据不能替代服务端的资源授权。

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

结构浏览独立于表行读取，按字段、索引、外键、约束、触发器和 DDL 分页签展示真实目录。复合键保持字段顺序，PostgreSQL 表达式键与 INCLUDE 列、MySQL 前缀 / 方向 / 可见性、SQLite 辅助索引键分别保留；外键跳转仍限制在当前连接，暂存写入时禁止跳转。目录未提供的事实返回未知，不从空值猜测支持。SQLite 的 CHECK、声明约束名、部分索引条件与延期属性以原始 DDL 为准，PRAGMA 外键编号不能充当声明名。

DDL 使用只读编辑器，允许复制与下载。MySQL / SQLite 展示数据库原文；PostgreSQL 依据目录重建字段、Identity / 生成字段、约束、索引、触发器和注释，并明确标示来源与未包含的存储选项、权限、所有权和外部依赖。结构查看脚本不能等同于数据库备份，创建 / 修改 / 删除与 SQLite 重建必须另经变更计划和确认入口验收。

Redis 独立会话默认只读，解锁仅作用于当前设备会话，不持久化为配置、不授予命令台任意写入。当前 Standalone 写入入口需要 Redis 7+ 的脚本权限检查，以及快照 / 元数据和对应变更命令权限；旧版本继续按实际可用能力读取，其他入口与版本的写入仍须单独验收。String、List、Set、Hash、ZSet、Stream 的创建与编辑、删除、Key 重命名和 TTL 通过同一预览 / 确认入口执行。Key、字段、成员、值均保留原始字节；文本与 Base64 切换不得改变字节，完整字符串编辑另行读取，不能把 64 KiB 浏览片段当成完整值写回。

编辑版本由设备会话持有，绑定 Key 的完整 DUMP 与绝对过期时间，读取前后不一致时不开放编辑；预览与提交再次检查版本、类型、目标重名及权限。计划五分钟内有效且只消费一次，重新锁定或断开立即撤销已生成和正在生成的版本 / 计划。当前有界编辑范围为约 1 MiB 的 Key 内存与序列化内容、List 索引 0–9999，超限仍可读取但必须明确显示编辑限制；大 Key 编辑和批量变更是后续独立能力。

普通内容编辑保留 Key 过期时间，Hash 编辑在 Redis 7.4+ 可用时保留原字段的毫秒期限；所需权限不足时不能忽略失败。相对 TTL 从确认执行时起算，绝对时间使用客户端所选本地时间转换后的时间戳，永久表示 PERSIST。重命名不覆盖目标，List 按索引删除采用碰撞检查后的独立标记。Redis Lua 本身不回滚：多步变更先检查全部命令与 RESTORE 权限，遇到执行错误恢复原始快照；补偿或连接结果未确认时显示明确错误，要求刷新核对，不自动重试。

Redis 数据库切换先建立独立客户端并明确等待 SELECT 成功确认，成功后替换会话、撤销旧计划并重新锁定写入；切换失败保留原来的已验证连接。不能仅依据客户端 ready 事件认定 SELECT 成功，也不能修改正在处理其他请求的客户端 DB。保存配置中的默认 DB 不因工作台切换而改变。数据库目录读取 CONFIG 与 INFO Keyspace，配置数量未知时只列出实际观察到的 DB，数量不可读时显示未知并允许手工编号验证；目录每页最多 128 项。旧会话关闭幂等，仍存在的其他原生会话不得被关闭。

Hash 分页保留字段的 HPTTL 毫秒值，旧版本或读取权限不足时显示未知与原因，不推断为永久。Redis 7.4+ 的字段期限修改通过同一变更计划执行，支持相对期限、绝对时间与 HPERSIST，保留 Key 的期限，拒绝缺失字段和权限不足。

命令历史只记录通过只读规则并实际尝试执行的命令；被规则拦截的 AUTH / SET 等输入不得持久化。历史绑定保存的连接，保留准确的执行 DB、时间、成功 / 失败和最多 16 KiB 的输出，截断明确标示；每个连接最多保存最近 100 条，当前 DB 与本连接所有 DB 可分别查看、召回、重用与复制。保存连接的历史位于当前设备，断开重连后仍可读取；未保存的直接会话历史只留在内存。清空覆盖本连接所有 DB，删除连接同时释放所属会话并清除历史。完整查询历史、搜索、收藏与其他入口按独立能力推进。

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

授权必须绑定 `instanceId + scope + normalized operation hash + expiry + actor`，使用一次即消费。目标改变、内容改变、过期或重连 generation 改变都使授权失效。生产范围默认不允许 Agent 自动写；即使连接策略允许写，也至少需要每次显式确认。

直接行编辑采用相同的预览 / 提交原则：连接会话默认只读，用户先解锁表格写入；SQL 查询入口继续执行只读策略。服务端持有不可修改的变更计划，绑定会话、Schema、表、字段结构快照和五分钟有效期；提交入口只接受计划 ID 和明确确认，不接受替换 SQL 或参数。计划在执行前消费，锁定写入和断开连接撤销未提交计划。每批最多 100 项变更，全部在一个数据库事务中执行；逐行锁定并核对读取时的完整原始行，冲突或约束失败使整批回滚。首批修改 / 删除要求主键或非空单列唯一键，计算字段不能直接赋值，MySQL 仅接受 InnoDB 表。无键行保护、长任务取消、未知提交结果核查，以及 Agent / CLI / MCP 的统一 Approval Grant 仍须按各自入口扩展，不能将此 UI 计划直接视为已完成全产品授权。

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

权限以明确的 Instance 和实际数据库 / Schema / 对象 / key-prefix 逐层收窄，不依赖产品工作空间。当前设备入口仍以 Bearer 认证、精确连接授权、原生会话及数据库原生账号权限共同执行；细分治理策略需要按真实能力逐步实现，不能把单个 `readOnly: boolean` 宣称为完整授权模型。

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

它们在视觉上始终属于“连接器”，共享 Workbench 只是详情页内部的模块边界。用户返回时回到对应 Provider 的 Instance 列表，不跳转到另一个一级产品。 工作台资源侧栏使用与内容区相同的面板底色，浅色主题为白色；页头由返回按钮、连接名称、产品类型、连接状态和实际操作组成，不添加装饰性的数据库徽标。

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

- SQL 草稿直接作为工作台顶部工作对象标签，与数据表和其他视图共用一排。每个标签整体反馈，只保留标题、状态点和关闭按钮；固定、重命名、重排、历史、SQL 库、比较与写操作审查通过右键菜单访问。SQL 工具栏沿用 DBX 的功能顺序和颜色语义，17 个主操作采用 22 px 加粗图标与 32 px 点击区，运行、格式化、折叠、关键字大小写、自动换行、诊断、结果面板和文件操作各有真实行为；只读和草稿状态以图标呈现。连续白色行号栏使用 SVG 运行入口与真实执行状态，不使用字体字符充当图标。固定快照和当前语句共用一排结果标签，以真实单表来源命名，歧义来源保留通用名称，重复来源以序号区分；中间显示当前来源，右侧提供字段筛选、跳转列、原生 DDL 和网格工具。第二行使用 14 px 文字与 18–20 px 图标，呈现数据表 / 摘要 / 图表 / 消息、已返回行范围、执行计划、保存结果、刷新与自动刷新；文本 / JSON 放入同一个范围菜单。固定快照捕获数据库和 Schema，保持只读且不能刷新覆盖；自动刷新只在当前查询页可见、SQL 未修改且不含参数时执行，关闭最后结果停止刷新。操作提示复用 AppAlert，不插入额外提示条。编辑器与结果区保持可调整分隔，结果与工具浮层遵守资源、原值和只读执行边界。
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
