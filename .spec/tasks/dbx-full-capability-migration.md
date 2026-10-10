# DBX 全能力迁移至 Fouc：任务总表

> 状态：迁移进行中。此文件是持续维护的任务清单，只有标注「已完成」且通过验收的任务代表已交付。现有状态沿用此前记录，尚未逐项重新验收。基线为 `opensource/dbx` 的 `f909f85075e12beb78dffe5942f7d039bede25de`，原始核对日期 2026-09-24。

## 进度与证据

- 工作台入口与布局：连接页头40px、资源工具栏与两层页面标签32px；标签采用整体容器、垂直居中且仅以背景区分激活，不保留下划线；Schema对象、关系图、数据库文档、活动监控提供常驻入口和各视图通用菜单；专项标签可关闭，SQL关闭等待草稿保存并阻止运行中查询。连接信息弹窗按身份 / 路径 / 参数 / 行详情分区。资源栏提供目录 / 名称升降序、表 / 视图筛选、定位展开及滚动、全部折叠、32px侧栏收纳与恢复。真实SQLite 1754×964 / 390×844验收：36行订单、5个文档对象 / 31字段 / 3外键、ER关系图、PRAGMA监控、4行订单汇总图表、SQL关闭重开 / 刷新后草稿恢复、运行中阻止关闭及取消、弹窗边界 / Escape / 外部关闭、搜索及类型筛选后定位恢复、排序 / 折叠 / 收纳操作、整块标签及内层查询标签垂直中心、键盘切换 / 关闭非当前标签不切页。定向前端类型与ESLint、docs / architecture检查通过，三个dev端点200；无Tauri构建。此项不改变全能力迁移任务的完成状态。

- **首阶段约5万行迁移完成**：按Git暂存区实际实现统计，574个核心运行文件、50,784有效行、54,477物理行；排除样式、测试、工具、生成目录、演示数据与DBX参考源码。首阶段集中验收：DBX Bun --isolate 602通过、5个真实环境条件测试跳过、0失败/4647断言；上述环境条件能力已有分模块真实MySQL/Pg/SQLite/Redis/Mongo流程证据。shared/device完整类型、修改前端ESLint、Web production build（含前端类型）、architecture/docs/DBX任务检查通过；无Tauri构建。三个dev端点200，PostgreSQL/Redis容器healthy并保持后台watch。 仅完成本次5万行规模与已实现子集验收，171项全能力任务仍按各行实际状态推进。

- S05：三库复合索引创建/删除（5P0/56）与MySQL/Pg复合外键创建/删除（3P0/28），真实原生目录/引用顺序/权限/受控DDL/5分钟一次性计划；真实三库索引及两库外键创建→回读→删除、1440/390通过。外键入口拆为hook/设计器/审查/对话框；SQLite外键重建尚未开放。
- Q08：基于真实双向复合FK生成ON/合法USING，当前SQL语义块/别名/引号与元数据缓存隔离；5P0/37、定向TS/lint和真实三库双表JOIN执行、Chrome实际补全→两行查询1440/390通过。
- Q09：真实JOIN来源卡显示关系/字段/生成条件，不虚构无FK关系；复用Q08必要P0及1440/390实际流程，窄屏来源卡裁切已修正。更多SQL语法与完整方言补全仍待后续。
- D01：原生三库清空审查/行数/权限/入向FK/触发器/identity策略，全名危险确认后一次提交；5P0/56，真实三库2行→0、readonly0写入、FK阻断、lock/旧计划/scope/single-use拒绝和SQLite实际UI/表页刷新1440/390通过。修复unlock未撤销旧计划与Pg ACCESS EXCLUSIVE后外部collector自身锁阻塞；锁内同事务固定catalog/count复核。
- P02：MySQL/Pg只读账户/角色/可见权限与快照JSON（4P0/27、两库native、Pg实际1440/390）；MySQL事件/Pg扩展原生目录/定义/版本/OID成员/权限，只读copy/download（5P0/52，真实DISABLED event时区/大数正文与SHOW CREATE EVENT、既有plpgsql1version/4members、两库1440/390，0mutation/0pageerror）。SQLite不适用；账户变更、事件编辑、扩展安装/升级仍待后续。

- 固定结果 / Redis批量 / 建表 / CSV / MCP / SQLite备份：G08 有界原生结果转置/原始精确TSV、不可变固定结果与独立页签状态；6项P0/25断言、定向TS/lint与真实SQLite pin→重跑保留旧值→transpose→unpin/close通过，1440/390查看并修正结果区实际高度；相邻Explain/Mutation重复React key已修复，同次新SQL实际流程确认执行计划1项、samekey0。 X01 Redis指定已载入keys批量delete/persist/相对与绝对TTL，只读DUMP/绝对过期CAS快照→unlock后重审→一次受控EVAL，原生ACL全项预检和真实partial/unknown。6项P0/73断言（34原生）、定向TS/lint及真实DB15三个key审核0写入→一次TTL且DUMP保持，1440/390通过；不提供wildcard全库批量。 S02 三库原生新建表字段/类型/nullable/PK/unique/identity/受控默认值→readonly完整DDL→unlock→显式确认→目录刷新。5項P0/52断言、定向TS/lint和MySQL/Pg/SQLite实际create/structure/default insert精确回读、own tables清理；实际MySQL1440/390通过。外键/计算列/CHECK/分区/独立索引不在该设计器本批范围。 X02 新增CSV/TSV完整词法与header/delimiter/null策略、explicit source→typed JSONPointer/BSON映射，复用既有ordered append；9项P0/68断言、定向TS/lint与真实Mongo CSV review0 writes→once append2精确Int64/Decimal128/ObjectId/nestedInt32/quotednewline，1440/390通过。BSON转换提取到共享单函数避免重复；未交付CSV导出或dump。 A04 标准SDK stdio与显式开启loopback StreamableHTTP、strict连接/Schema/表/namespace范围与tools白名单、只读会话工具及16原生tools/resources/prompt。6项新P0/38断言、薄TS通过；实际标准stdio SQLite握手/精确查询/分页/固定会话/close/写入与越界拒绝，HTTP标准客户端双隔离会话/Token/Host/Origin/DELETE通过。 A08 16只读MCP tools复用设备原生目录/注册SQLcancel/immutable capture/scope UUID固定会话/context/文档/Schema对象/Redis/Mongo；细粒度资源范围不能授权任意SQL，SQL须完整连接grant。真实标准客户端和新P0通过；写入/显式事务/桌面打开与全DBX工具仍待后续。 A09 默认stdio，HTTP仅显式transport=http且32字符Token，固定127.0.0.1:8712/mcp，Host/Origin/1MiB body/8 clients/4 calls/10minidle；官方StreamableHTTP session隔离与关闭清理。新HTTP2P0/15断言通过，未执行Tauri/安装包或跨平台分发。 D06 SQLite原生readonly transaction+backup覆盖已提交WAL，独立worker/owned artifact/120s timeout/TTL/限额/鉴权下载/真实取消close。3P0/29断言，定向TS/lint和单Chrome实际WAL→64MiB Blob回退→Node回读BIGINT/decimal/blob→close清理通过；1440/390已查看。恢复及其他驱动备份仍待后续。

- 监控 / Mongo文件 / SQL文件 / Schema / CLI：2026-10-04快速批次：P01 MySQL/Pg真实状态与进程、5秒暂停/隐藏跳过轮询、有界趋势、搜索/排序/SQL详情；SQLite仅原生PRAGMA。5项P0/47断言、Pg后台进程补充11断言，定向TS/lint与两库1440/390实际界面通过。 X02 JSON/NDJSON Canonical EJSON完整文件解析/typed pointer/ID策略→既有collection零写入审核→一次ordered append，真实部分成功与取消；native cursor有界NDJSON流导出及BSON scalar精度保留。7项P0/55断言、定向TS/lint与真实Mongo下载→上传→review→once append，1440/390实际界面通过。CSV/ZIP/dump仍待后续。 D01 字面量INSERT SQL原生方言解析、完整文件拒绝脚本/DDL/表达式、显式列映射与一致来源目录、保持BIGINT/DECIMAL原文本，复用服务端事务导入。4项P0/78断言、定向TS/前端lint与真实SQLite local/server review0写入→confirm2行精确回读，1440/390已查看。 S08 MySQL CREATE DATABASE/PG当前DB CREATE SCHEMA原生目录与角色权限检查、quote安全名称、5分钟session一次性审查，readonly prepare→unlock→explicit confirm→目录刷新。5项P0/50断言、定向TS/lint与两库实际创建及1440/390通过；MySQL隐式DDL/未知确认如实。管理删除/完整驱动矩阵仍待后续。 A05 只读设备HTTP CLI含doctor/capabilities、工作空间连接目录、borrowed/owned会话、库表/结构/行、registered SQL/cancel、context/DBML/Markdown、Redis页/Mongo EJSON页；精确Table/JSON/CSV、输出文件显式overwrite、稳定非零错误码与环境口令。6项P0/31断言、薄TS通过；原生SQLite 2 SELECT/精确数值、rows CSV、DBML、写入拒绝与5个隐式会话关闭均通过。CLI文件在repo ESLint ignore内，未虚报lint。直连/云/DeepLink/写入/MCP仍待后续。

- 配置文件 / 测试数据 / 字节详情：2026-10-04：C04当前公开配置JSON完整预览→串行CRUD，空间/provider范围、同名默认改名/跳过/显式更新、真实部分失败/取消；PBKDF2-SHA256 600000+AES-256-GCM认证头/randomsalt/IV加密，秘密与资源ID不导出。7项P0/48断言、定向TS/lint，一次Chrome实际文件加解密与创建/更新/跳过通过。D09种子可重复5000行/5MiB/100000cells、逐字段生成与原始精确BIGINT/DECIMAL、FK与默认/生成列边界；5项P0/198断言，真实SQLite/MySQL样本与prepare0写入、confirm:false拒绝、一次追加5行及默认/生成值回读；复用原生导入引擎。G10原生binary envelope严格字节解码、有界HEX/ASCII分页/偏移搜索、UTF8/只读原值、栅格头部/像素预算/原文件下载；3项P0/26断言和一次原生SQLite BLOB页面下载逐字节一致、PNG实际解码。1440/390实际视觉检查，修复二进制详情被缩小结果区与窄屏祖先裁切，使用统一overlay宿主。第三方配置/vault、FK采样与多表生成、更多复杂类型继续后续。开发不重复旧模块矩阵；临时数据清理，服务常驻。

- MongoDB GridFS 文件：2026-10-04：X02原生Mongo GridFS桶/孤儿目录、文件分页筛选排序、精确Long容量与EJSON详情、lazy原生流鉴权下载/断开取消均接实际工作台。4项新增P0/45断言，真实Mongo上传独立夹具→原生读取→HTTP字节一致及custom BSON scalar ID；实际Chrome只读浏览→下载65637字节与源逐字节相同，1440/390已查看/无外溢或pageerror，修正窄屏桶选择和内部滚动。native下载1GiB，Web无FS Access时64MiB回退；原生流5min并保持controller直到close。前后端定向TS/lint通过，不重复旧CRUD回归；FS Access系统保存、上传/删除/ZIP/dump及完整入口仍待后续。

- 连接参数 / SQL变更审查 / 全表导出：2026-10-04：C02唯一connectionOptions贯通MySQL/Pg/Redis/Mongo原生TLS/严格证书/主机名和timeout，URL/libpq DSN反向填表、PEM Web上传、敏感值仅临时重传；20项新增P0/160独立断言，自有TS/lint及真实MySQL URL填表→连接测试通过。Q10原生三库单表确定性INSERT/UPDATE/DELETE只读改写与旧新值/COUNT，五分钟一次性计划、权限/结构/WHERE/原值再核对、真实事务锁与取消回滚，COMMIT回应丢失标记unknown；8项P0/83断言，真实页面预览0写入→解锁撤销旧计划→重新预览→确认提交。D05/G06原生三库多对象SQL/CSV/JSON/NDJSON导出、精确游标/无主键offset、ZIP STORE+CRC/完整分包、设备磁盘预算/进度/取消/恢复/流式附件；4项P0/86断言及三库SQL回放，真实页面全表NDJSON下载精确大整数/中文、关闭重开恢复并清理。根API另验证空间隔离/只读/确认/计划失效/两页导出和附件字节。1440与390实际视觉检查，SQL审查窄屏固定操作区和select标签修正；类型/lint通过。本批未重复旧矩阵，实际TLS服务/多认证/其他驱动、完整入口及FS Access保存分支仍待阶段验收，语句子集/隐藏元数据权限/独立读取非快照明确限制。

- 批量网格 / 原生元数据 / 传输 / 图表：2026-10-04：开发仅新增P0与一次实际入口流程，已通过模块不重复矩阵。G04批量粘贴/复制/填充、100层撤销/重做及原始行保护，10项71断言及JSON null边界；实际两行中文单引号粘贴→原值预览0写入→撤销重做→提交回读，大整数保持精确、提交后清空历史。S04/S05三库原生视图/函数/过程/触发器/序列目录、精确Pg OID/重载、源码DDL/参数/引用，4项34断言及原生三库；修正真实MySQL VIEW_ROUTINE_USAGE字段。D02追加传输7项45断言、六方向原生类型往返，根接口验证空间/只读/重新锁定/一次性计划/结构指纹；实际MySQL→SQLite大整数和中文回读。Q07动态ECharts五图/多指标/分组/精确聚合/范围和持久设置，11项59断言，实际SVG与SUM 20保存设置。S03当前连接有界原生对象字段搜索10项55断言，实际字段定位结构过滤；S06实际外键/复合JOIN/布局缩放导出8项63断言，生成JOIN打开新SQL标签实际执行；S07原生文档、本地Markdown笔记/彩色分组/CAS/DBML导出5项48断言，真实设备持久保存并验证空间和版本冲突。前后端定向TS和自有lint通过，1440与390实际查看；窄屏文档改上下分区、ER图可滚动详情与resize保持中心、图表内部滚动/操作标题修正。跨连接全局搜索、写入对象管理、全类型批量编辑、建表/清表/断点传输、更多驱动/CLI/MCP及完整入口矩阵继续实施/阶段末回归。

- MongoDB / 表格布局 / 结构编辑：2026-10-04：开发阶段仅新增P0与一次实际流程。MongoDB8原生库/集合/筛选排序分页/聚合/索引/元数据和Canonical EJSON精度，读取6项57断言、窄写入5项56断言；原始完整BSON CAS、类型/权限/空间/一次性计划与取消。Chrome真实创建连接、筛选文档、只读解锁、预览0写入、确认后大整数原值回读。网格列隐藏/NULL列、左右冻结/排序/宽度/密度/日期/JSON路径/掩码/模板，22项95断言及刷新选择映射P0；实际原始复制、显示格式与重新执行布局保留。结构编辑9项64断言、三库实际DDL，权限与计划撤销/结构变化/原生提交接口P0，真实MySQL中文含单引号注释预览0写入后确认回读。1440与390实际视觉检查，修正Mongo窄屏资源导航、结构审查局部滚动与固定操作区、主按钮对比度；自有TS/lint通过。不重复此前通过矩阵。Mongo GridFS/导入导出/dump、批量更新/其他拓扑，网格转置/自动刷新，结构外键/约束完整编辑及全入口矩阵仍未完成。

- 表导入 / 数据与结构比较：2026-10-04：开发阶段仅必要P0。CSV/TSV/JSON/NDJSON严格解码、原始数字、字段映射、默认值/NULL和原生三库参数化追加；预览0写入，一次性计划、重新锁定、空间隔离、字段变更和事务失败回滚。数据比较14项P0覆盖显式键/字段映射、重复键冲突、缺失与NULL、精确数值/JSON/二进制、选择性SQL审查。结构比较10项P0及真实三库DDL回放核对字段/索引/生成列/SQLite重建数据；依赖顺序与不支持项明确标示。实际Chrome完成CSV两条大整数/中文导入回读、两次查询结果差异→新SQL审查标签、真实双表结构→DDL审查；比较不自动执行。1440×1000与390×844实际视觉检查并修正结构比较窄屏操作区。自有类型/lint检查通过；Excel/SQL导入、流式大批量、多目标同步、自动结构部署/OSC、其他驱动和全入口矩阵留到后续实现与阶段集中回归。

- 执行计划 / 网格选区 / 导出：2026-10-04：开发阶段仅P0。MySQL JSON/标准、PostgreSQL JSON、SQLite QUERY PLAN 真实计划；8项原生计划P0、15项选择/精度P0、12项导出P0（原生三库字面量往返）。Chrome实际流程验证EXPLAIN接口/图形/树/原始计划、大整数详情/范围选择/精确求和/复制、选定两行一列CSV下载；1440×1000和390×844实际视觉检查。修复网格遮挡导出栏与浏览器计时器非法this绑定。仅本次已加载结果；ANALYZE、其他驱动/全入口、写入粘贴/布局设置、XLSX/ZIP/全表流式导出仍待阶段回归或实现。

- SQL 辅助 / 浏览器文件：从固定 DBX 源码并行移植原生三方言函数补全 / 参数提示 / 文档悬停、别名与 CTE 诊断 / 高亮 / 定义跳转、限定字段 / 通配符 / 文本引用 / 注释 / IN 列表 / 表查询快速操作、SQL 文件编码读取与 UTF-8 下载。开发 P0 覆盖语义作用域、原始字面量 / 整数精度、单次撤销和陈旧内容保护；实际 Chrome 流程完成诊断纠正、函数字段插入 / 参数提示、大小写 / 撤销、IN 列表真实 MySQL 执行、UTF-16 BOM 中文 / emoji 文件执行与无损下载。1440×1000 与390×844 实际检查快捷弹窗和函数提示。大于 1 MB 文档尾部的短语句真实执行通过：原始偏移按文件上限校验，变量声明上下文不会误带整段文件。焦点 / 提示状态变化不误拒绝编辑。前端 / 设备类型、架构 / 文档 / 迁移矩阵与自有 ESLint 检查；完整方言、版本和入口组合继续留到阶段集中回归，Q01/Q02/Q06/Q09 保持进行中。

- SQL 格式化 / 片段：DBX AST 排版层、保留注释与引用、选区优先格式化 / 压缩、一次撤销、异步陈旧结果拒绝、完整文档保存时格式化已接入三种原生数据库；`bun scripts/verify-sql-format-live.ts` 验证格式化 / 压缩前后的实际结果一致（大整数、Unicode / 多行字符串、MySQL 注释、Pg 相邻字符串 / E / dollar、SQLite 方括号）。十一种默认片段与自定义编辑 / 搜索 / 启停 / 重排 / 删除、字段导航及配置导入导出均有运行实现。偏好按 workspace + connection 保存，严格完整快照校验与版本比较，临时会话 / 删除清理；P0 覆盖隔离、冲突不覆盖、陈旧格式化不覆写。Chrome 一次流程完成格式化 / 撤销 / 实际执行、设置保存、动态片段插入与选区下完整文档保存；浅深 1440×1000 与 390×844 实际视觉检查。Q02 保持进行中，其他方言 / 入口矩阵仍待阶段集中回归。

- SQL 参数工作流：三种原生数据库已接入五种占位符、五种参数类型、引用 / 字符串插值、MyBatis 集合 / where / 索引 / 实体、`@set` 前缀上下文与可恢复历史。共享编译、输入诊断 / 精度 / 展开限制、完整只读批次预检及 UTF-16 原始定位均有真实接口证据：`node scripts/verify-sql-parameters-live.mjs`。弹窗沿 DBX 的紧凑参数表格 + 高亮预览布局，浅深主题 / 1440×1000 / 390×844 验证焦点、类型错误、复制反馈、键盘执行、Escape 取消及标签内最近值隔离；实际三库返回参数 / 集合结果。196 项数据库 / SQL 工作台 / 原始 JSON 作用域测试、892 个断言通过；原生多结果 / 取消回归仍通过。语法开关、其他方言与全部模板入口仍待覆盖；Q01 / Q03 / Q05 / Q08 / Q09 保持进行中。

- SQL 执行工作流：三种原生数据库已支持词法当前语句 / 全部 / 选区、顺序多结果标签、完整只读批次预检、错误后停止、UTF-16 原始来源、驱动取消确认 / 部分结果保留 / 连接复用和断开中断。`node scripts/verify-sql-executions-live.mjs` 为真实接口回归；103 项作用域测试 / 751 个断言通过。浏览器以 DBX 布局验收浅深主题、1440×1000 / 390×844、结果键盘导航、跨查询标签取消、失败定位和轮询恢复。Q06 已含编辑器分段执行 / 进度 / 取消和浏览器 SQL 文件读取 / 下载；流式执行、ZIP 与任务恢复尚未迁移；全部涉及任务保持未完成。

- RedisJSON 验证入口：`node scripts/redis-json-lab.mjs up|status` 维护独立官方 Redis 8.2.2 / ReJSON 8.2.1 实验室（56381），`node scripts/verify-redis-json-live.mjs` 只操作 DB 15 的命名 Key / 一次性 ACL 用户。完整原始 JSON、整数精度、null / 根数组 / 二进制 Key、NX 新建 / XX 编辑、预览不写入、一次性计划、精确 TTL、内容 / 期限冲突与重新锁定撤销通过；MODULE / MEMORY 可选权限、COMMAND 未知、GET / SET 权限失败恢复、2 MiB 完整读取限制、7.4 无模块、空间与历史边界均有真实证据。六类型写入原生回归通过，44 项 Redis 作用域测试 / 348 个断言通过。Chrome 1440×844、760×844、390×844 验证 Unicode / 原始转义、格式化 / 压缩、折叠 / 搜索 / 撤销 / 重做 / 换行 / 复制、无效草稿 / 丢弃 / 导航保护、Ctrl+S / 预览取消 / 参数确认、TTL 保留、JSON 新建 / 返回编辑及真实冲突 / ACL 失败恢复 / 模块缺失。两次预期 HTTP 400，无其他页面 / 控制台错误；编辑器和弹窗操作均可见。X01 / R07 保持进行中，其他 JSON 模块版本 / 拓扑和全入口矩阵待验收。

每个任务的记录状态见下表和 [迁移跟踪矩阵](dbx-migration-tracker.json)。矩阵记录负责人、DBX 来源、适用驱动与桌面/Web/CLI/MCP 入口、回归用例和验证摘要；[DBX 目录源](../../shared/catalog/dbx-catalog.json) 包含已复制进 Fouc 的驱动、Profile 和 SQL 方言元数据。运行 `pnpm dbx:verify` 检查任务、状态及目录映射；若本机有 `opensource/dbx` 源码，还会核对源文件哈希。状态只有「待实施」「进行中」「已完成」；通过实际验收并填写摘要后才能改为已完成。

## 代码规模与当前验证

- SQL 语义 / 元数据补全验证：`sql-semantic.test.ts`、`sql-metadata-completion.test.ts`、`sql-read-structure.test.ts` 与 `node scripts/verify-sql-drafts-live.mjs`。2026-10-03：从固定 DBX semantic/{model,types,dialect,tokens,completion}、cteNavigation 与 sqlSyntaxTreeWindow 适配原生 MySQL / PostgreSQL / SQLite 的词法、查询块、投影输出和原生元数据解析。CTE 链、嵌套 WITH 遮蔽、显式输出列表、星号顺序、多层派生表及派生列重命名已接入实际补全；普通字段改名保留真实类型 / 注释 / 来源，表达式未知类型不伪造。未引用 CTE、兄弟查询和非 LATERAL 派生体不带入其他字段，LATERAL 内只看前面的同级表，Pg 大小写 / DISTINCT ON / MATERIALIZED、各方言 WHERE / GROUP BY / HAVING / ORDER BY 结果别名有作用域证据。真实查询另核对 Pg UTF-8 非 ASCII 名称保留 / ASCII 折叠、MySQL 字段大小写宽容与 Linux CTE 名称精确、SQLite ASCII 比较及原生目标名称映射；三种数据库的 Ä 字段补全选择后均实际返回 Alpha。递归锚点与列声明有界，最多八层；CTE 语句 / 单体推导以20000 / 5000 token限制，超限仅保留已知名称。CodeMirror 增量 Statement 窗口保持全局 UTF-16 偏移，Pg dollar 文本和嵌套注释回退原生词法。共享词法由 @fouc/shared 公开导出；设备只读检查只对已验证 CTE / 派生列表 / LATERAL 和 MATERIALIZED 声明做局部识别，实际函数、可执行注释和写入仍受原检查及数据库只读隔离约束。表 / 字段读取共用最多四路并发，刷新撤销排队与旧响应。Chrome 1440×1000 浅深主题及390×844 在三种真实数据库完成 Ctrl+Space 选择字段→Ctrl+Enter 返回 Alpha；递归实际返回1/2/3，嵌套 WITH / 输出列表 / 物理限定同名CTE / 多层派生表均执行通过；MySQL / Pg 另验证 LATERAL 和派生列列表，Pg 验证 DISTINCT ON 与 NOT MATERIALIZED。字段来源浮层通过 CodeMirror 独立层挂到当前 Fouc overlay 宿主（Web回落body），缓存视图重绑宿主；浅深 / 390px窄屏实际检查四边界与中心 / 角点命中，避免被编辑器 / 状态栏 / 结果区裁切或遮住，浅深 / 窄屏来源与类型完整可见；刷新失败保留SQL并可重试，读取中换标签丢弃旧结果，MySQL 切换 information_schema 隔离真实对象。最终浏览器仅三次故意 HTTP503，无其他页面 / 控制台 / HTTP 错误。数据库 / 设备API / SQL工作台 / JSON回归97项、703断言通过，命令级30秒磁盘测试时限，不修改源测试时限。前端 / 设备 / 共享类型、前端零警告 ESLint与架构 / 文档 / DBX矩阵检查通过。完整 AST / 方言模式、复杂递归 / 相关子查询输出来源、USING / NATURAL 星号合并、表函数推导、外键 JOIN、完整跨方言悬停 / 对象跳转 / 语义诊断、大文件流式任务与其他驱动 / 全入口仍待实现验收。

- 工作台视觉验证：2026-10-03：按固定 DBX screenshot-light / screenshot-grid 与资源树、SqlEditorWorkspace 源码复核真实渲染。MySQL8.4、PostgreSQL17、SQLite、Redis7.4 的连接目录、SQL / 表格 / 行详情、Key / PING 命令台 / INFO 概览在 Chrome 1440×1000、390×844 完成浅深主题和真实内容检查（SQL 标签功能另在760×844验收）；控制台、页面和 HTTP 无意外错误。五项对照：资源树灰底 / 类型颜色 / 实际计数，40px文档标签与中性工具栏，13px资源与表格正文及14px SQL语法 / 行号基线，指针和键盘编辑器结果分隔线及独立统计导出栏，浅深主题 / 可关闭详情 / 窄屏目标行与可见草稿状态。保留 Fouc 原导航、主题字体和当前能力的只读默认，不复制 DBX 图片或账户/云界面；AI 面板、全部专项页面、编辑器分组 / 独立窗口与全入口仍待实现验收。

- SQL 标签 / 草稿验证入口：`node scripts/verify-sql-drafts-live.mjs`；作用域测试与 Chrome 1440×1000、760×844、390×844 验证三种原生数据库的独立内容 / 撤销 / 选区 / 结果 / 上下文、固定 / 改名 / 复制 / 关闭确认 / 最近关闭恢复 / 导航 / 拖动、异步查询归属、串行保存与返回等待、文件基线 / 原目标恢复、真实版本冲突 / 完整设备预览 / 保留双方合并、重连 / 刷新和明确空状态。SQLite 长文档与首次隐藏挂载的选区 / 滚动恢复、全部关闭后重开与再次执行通过；新视口对旧像素偏移按实际滚动范围裁切。文件与草稿冲突是预期 HTTP 400，无其他页面 / 控制台错误。Q01/Q02/Q03/Q05 保持进行中；编辑器分组 / 独立窗口、流式文件任务、完整语义补全及其他驱动 / 全入口仍未完成。

- Pub/Sub 验证入口：`node scripts/verify-redis-pubsub-live.mjs` 使用独立 Redis 7.4.8 实验室（56380），真实 HTTP NDJSON 与 RESP2 独立订阅连接验证空 / 二进制频道、消息和模式，跨 DB、频道和模式重复投递、四类订阅操作及批次中先成功后被 ACL 拒绝的确认状态。64 KiB 截断、捕获 ID / 会话 / 空间隔离、写入解锁 / 预览确认对应的发布授权、精确接收计数、无历史 / 无 Key 写入和权限恢复通过；实际投递后响应丢失明确显示结果未确认且无自动重试。通过实际 CLIENT LIST 验证 HTTP 取消（含真实 PING 确认前）、DB 切换、会话关闭与意外断开释放连接。38 项 Redis 作用域测试 / 289 个断言通过。Chrome 1440×844、760×844、390×844 验证订阅 / 取消、二进制 / 空值、ACL 失败恢复、重连恢复与断开消息不补发、最新 500 条保留、筛选 / 无匹配 / 复制 / 跟随 / 清空 / 详情截断、发布预览 / 返回编辑 / 确认 / 重新锁定；弹窗正文局部滚动且操作始终可见。两次预期 HTTP 502，无其他浏览器错误；共享连接生命周期和流解码抽取后 MONITOR 真实接口 / 三宽度浏览器回归通过。X01 / R07 保持进行中，其他版本、TLS 矩阵及全入口 / 拓扑验收未完成。

- MONITOR 验证入口：`node scripts/verify-redis-monitor-live.mjs` 使用独立 Redis 7.4.8 实验室（56380），真实 HTTP NDJSON 流验证独立客户端、微秒时间 / 所有 DB / 来源 / 二进制转义、16 KiB 截断、正常会话和历史保留。通过实际 CLIENT LIST 计数验证 HTTP 取消（包含 TCP 夹具延迟服务端确认前取消）、停止、会话关闭、DB 切换、ACL 拒绝 / 恢复、意外断开均释放客户端；路由鉴权和跨空间拒绝已覆盖。60 项作用域测试、421 个断言通过，包含缓冲条数 / 字节压力、分片 UTF-8 / JSON 帧、格式错误与迟到确认。Chrome 1440×1000、760×844、390×844 验证命令台入口、真实 DB14 / 15 和字节转义、筛选 / 无匹配 / 复制 / 跟随、最新 1000 条保留、可见停止按钮、离开视图 / 返回列表释放客户端、普通 PING / 历史、断开与 ACL 错误恢复；一次预期 HTTP 502，无其他页面 / 控制台错误。仍须推进其他 Redis 版本、完整入口与 Sentinel/Cluster / PubSub 矩阵。

- Stream 观测验证入口：`node scripts/verify-redis-stream-live.mjs` 使用独立 Redis 7.4.8 实验室（56380）与 DB15 命名夹具，验证消费组 / 消费者 / Pending、64 位完整消息 ID、二进制和空名称、未知 Lag / Inactive、100 条分页和游标 ACK 竞争、服务端消费者过滤、空 PEL。读取前后 DUMP / 绝对过期时间 / 历史 / 只读状态不变；数据库 / 空间隔离、无效游标、类型错误、组不存在、ACL 拒绝与恢复均通过。55 项作用域测试、386 个断言通过。Chrome 1440×1000、760×844、390×844 验证真实钻取、分页 / JSON 复制、刷新保留选择、消费者 / 组消失反馈、迟到请求撤销、拒绝时保留旧数据与重试，窄屏表格局部滚动；两次预期 HTTP 502，无其他页面 / 控制台错误。X01 / R07 仍进行中。

- Redis 观测验证入口：`node scripts/redis-observability-lab.mjs up|status` 复用或启动独立 Redis 7.4.8 实验室（56380，启动时阈值 0、保留 512 条），`node scripts/verify-redis-observability-live.mjs` 验证 INFO 分区与有界慢日志读取、原始二进制参数 / 客户端字段、数量校验、空间隔离、只读状态和命令历史保留、可选 CONFIG / LEN 权限降级及 GET / INFO 拒绝。实验室不会修改或重置业务 Redis 的日志配置。50 个作用域测试通过，涵盖 64 位计数 / 命中率 / 数值排序、旧版本缺失字段和响应截断。Playwright + Chrome 在 1440×1000、760×844、390×844 验证指标折叠 / 搜索 / 复制、真实定时刷新及离开视图后停止、慢日志数量 / 排序 / 筛选 / 分页 / 二进制详情 / JSON 复制、权限失败保留旧指标和错误恢复；两次预期 HTTP 502，无其他页面 / 控制台错误。Cluster 逐节点、其他版本与权限矩阵仍未完整交付。

- 源码已恢复至固定 commit；[源码审计](dbx-source-audit.json) 与 [实质迁移文件清单](dbx-native-port-manifest.json) 可由 `node scripts/audit-dbx-source.mjs --write` 重算。约 133.4 万有效源码行；排除独立测试、翻译资源、工具与账户/云模块后的核心范围估算为 91.4 万行。词法统计仍包含 Rust 内嵌测试，不能把这个估算当成已迁移量。
- 第一阶段目标仍为约 50,000 行 Fouc 核心运行逻辑；当前清单为 574 个运行文件、50,784 行有效代码。不计样式、目录 JSON、测试、参考仓库或演示工作台，且必须逐能力验收；首阶段规模与已实现子集已通过集中验收，全能力迁移仍进行中。MySQL 已合并到共享会话与工作台，移除的重复逻辑不保留行数信用。MONITOR / Pub/Sub 共享生命周期与流解码，删除的重复实现同样不保留信用。RedisJSON 仅计已适配且实际运行的 token 格式化 / Unicode 编辑映射子集，未使用的 Number 包装 / stringify 代码不计入。统计受代码格式影响，不能以行数代替功能覆盖。固定源码基线未变化时，可用 `node scripts/audit-dbx-source.mjs --native-only --write` 快速重算原生清单。
- MySQL / PostgreSQL / SQLite 的连接配置 CRUD、测试与会话打开、Schema/表/视图/字段发现、主键分页、只读 SQL、大整数/重复列名及空间隔离已有真实 HTTP 和浏览器证据。R01/R02/R03 保持进行中；完整对象管理、导入导出、比较/备份、取消/重连、CLI/MCP 等仍须推进。SQLite 读取已改为只读子进程隔离，注册批次的长查询取消已通过真实验收；写入取消、结果磁盘缓存与完整版本矩阵仍待推进。
- 验证入口：`bun test --isolate backend/device/src/database backend/device/src/api/server.database.test.ts src/features/connectors/datastore/result-format.test.ts`、`node scripts/verify-relational-live.mjs`、`node scripts/verify-mysql-live.mjs`、`node scripts/verify-table-save-live.mjs`。真实服务验证使用独立 `fouc_datastore_lab` 数据库、专用 `dbx_save_fixture` / `dbx_unique_fixture` 表与 `.runtime/dbx-lab/relational.sqlite`，不访问 Fouc 账户/业务表。MySQL 实验室通过 `node scripts/datastore-lab.mjs up|status` 运行，容器有认证健康检查，随机凭据只写入被 Git 忽略的运行目录。
- Web 验证：Playwright + Chrome，1440×1000 完成上述 PostgreSQL / SQLite 流程；390×844、760×844 检查连接目录、导航收起及溢出。两次故意写入产生预期 HTTP 400，未出现其他控制台或页面错误；窄窗口工作台操作矩阵仍待补齐。
- Redis 的独立连接器已接入共享配置 CRUD 与设备会话；原始字节/字符串游标、SCAN、String/List/Set/Hash/ZSet/Stream 读取、TTL、缺失 Key、只读命令台、消费组 / 消费者 / Pending / Lag 观测、实时 MONITOR、Pub/Sub 和 RedisJSON 文档读写已有真实 HTTP 与 Web 证据。X01/R07 保持进行中，尚未交付大 Key / 批量写入、完整命令执行 / 补全 / 历史搜索、其他 RedisJSON 模块版本、Sentinel/Cluster（含逐节点概览 / 慢日志）、大 keyspace 虚拟列表及全入口 / 版本 / 权限矩阵。
- Redis 验证入口：`node scripts/verify-redis-live.mjs` 使用独立 DB 15 与 `fouc:dbx-lab:` 前缀，只重置明确命名的验证 Key，不清空数据库、不访问业务缓存 Key。Playwright + Chrome 1440×1000、760×844 已验收创建/测试/保存/连接、六种类型、JSON、List/Stream 翻页、空状态/搜索、命令成功/错误及编辑/刷新持久化/复制/删除。一次故意写入产生预期 HTTP 400，无其他控制台或页面错误。
- Redis 有界写入新增六种类型创建、String / List / Hash / ZSet 编辑与集合添加 / 删除、Stream 消息添加 / 删除、Key 重命名 / 删除、相对 / 绝对 TTL 和 PERSIST。版本和一次性计划绑定当前空间 / 会话 / Key，读取、预览、提交检查完整内容与绝对过期时间；新旧内容、目标重名、自然过期和 ACL 权限不足均拒绝写入。普通编辑保留 Key TTL，Redis 7.4 Hash 编辑保留毫秒字段期限，List 删除不会与 DBX 的固定占位值碰撞。多步执行错误使用 RESTORE 补偿，不把 Lua 等同于事务回滚；超时结果未确认时不自动重试。
- 写入验证入口：`node scripts/verify-redis-mutations-live.mjs` 只重置独立 DB 15 的明确 `fouc:dbx-write-lab:` Key 和一次性 ACL 用户。Redis 7.4.8 已验证以上真实 API、210 KB 完整字符串、Base64、64 位 Stream ID、ACL 无残留和注入运行错误后的快照恢复；39 个作用域测试覆盖字节 / BOM、参数边界、鉴权与重新锁定的在途撤销。Playwright + Chrome 在 1440×1000、760×844、390×844 完成六类型创建、编辑 / 添加 / 删除、TTL / 永久、重命名 / 删除、预览取消与确认、冲突反馈和重新锁定；一次预期冲突 HTTP 400，无其他页面 / 控制台错误。当前编辑需要 Redis 7+，约 1 MiB Key 和 List 索引 0–9999；大值及其他版本矩阵仍待推进。
- Redis 管理验证入口：`node scripts/verify-redis-management-live.mjs` 只重置独立 DB 14 / 15 中明确的 `fouc:dbx-management-lab:` Key 与一次性 ACL 用户。已验证等待 SELECT 确认、切换 / 同 DB 无操作 / 失败保留旧连接 / 旧计划撤销、目录读取限制显示未知、二进制字段 TTL 相对 / 毫秒绝对 / HPERSIST 与 Key TTL 保留、权限不足不写入、命令历史持久化 / 准确 DB / 失败记录 / 规则拦截不存密码 / 空间隔离 / 连接删除清理。43 个作用域测试通过，包含 Redis 路由鉴权、64 位统计值和有界历史重新加载。Playwright + Chrome 在 1440×1000、760×844、390×844 完成字段 TTL、DB14/15 切换与重新锁定、失败、召回草稿 / 重用 / 复制 / DB 筛选 / 重连 / 清空；一次预期切换 HTTP 502，无其他页面 / 控制台错误。
- 三种关系型数据源的暂存新增/修改/删除、NULL/默认值/JSON/Base64 编辑、计算字段保护、SQL/参数预览、取消/确认与重新锁定已有真实 HTTP 和 Web 证据。计划绑定工作空间/会话并只消费一次；完整原始行冲突与重复键均回滚前序写入。复合/表达式索引及 PostgreSQL INCLUDE 列不会误判成单列唯一键。C05/C06/G04 均保持进行中，无键行、复制/粘贴/撤销、复杂类型、生产范围、Agent/CLI/MCP 授权、取消/未知提交结果与分布式事务未交付。
- 表编辑 Web 验证：Playwright + Chrome，三种数据源均完成 1440×1000 的写入闭环、暂存时表/页/连接导航保护与 SQL 页签保留；760×844 操作无溢出，390×844 编辑弹窗可滚动且操作区可见。提交后回读数据、结果反馈与重新锁定通过，无页面或控制台错误；其他工作台窄窗口功能矩阵仍未整体完成。

- 三种关系型数据源新增数据库侧参数化筛选与多列排序：18 种操作符、嵌套 AND/OR、含 NULL 的 IN/NOT IN、范围条件、JSON/Base64/大整数、NULL 位置与主键补充排序；提供 SQL/参数预览复制、草稿重置、条件清除、页大小与前后翻页。当前页搜索保留原始行索引，搜索后编辑不会写到另一行；暂存写入时阻止改变数据库查询。无主键时提示顺序可能变化，主键排序不表示跨请求快照一致。G03 保持进行中；当前结果值过滤/本地排序及其他驱动仍待覆盖。
- 筛选验证入口：`node scripts/verify-table-query-live.mjs` 使用独立 `dbx_filter_fixture` / `dbx_page_fixture`；33 个作用域单元/集成测试和 4 个架构边界测试通过。Playwright + Chrome 三种数据源在 1440×1000、760×844、390×844 验证真实搜索后写入、组合筛选、SQL 复制、多列/表头排序、NULL 列表、错误/重置/空结果与分页，无页面或控制台错误。窄屏搜索独占一行，筛选面板滚动时底部操作可见。

- 关系型结构浏览新增独立字段 / 索引 / 外键 / 约束 / 触发器 / DDL 页签，真实目录搜索、空状态、刷新与外键跳转；SQLite 缺失的约束属性返回未知并指向原始 DDL，独立唯一索引不会误报为表约束。MySQL / SQLite 提供原始 DDL，PostgreSQL 提供明确标示来源和限制的目录重建脚本，覆盖 Identity 方式 / 序列参数、列排序规则、生成字段、索引、触发器状态与注释。只读 CodeMirror 支持复制与 SQL 下载，不开放执行或结构变更。S04/S05 保持进行中，过程 / 函数等其他对象、结构编辑、完整恢复与版本矩阵未交付。
- 结构验证入口：`node scripts/verify-table-structure-live.mjs` 仅重建独立 `dbx_structure_*` 夹具；PostgreSQL 17 实验室中重建脚本经回滚事务验证，MySQL 8.4 验证复合外键、表达式 / 前缀 / 降序 / 不可见索引与 CHECK，SQLite 验证隐式主键映射、STRICT 与内存库重建。独立 MySQL 实验室关闭 binlog，以普通夹具用户创建触发器，不给产品数据源账号增加 SUPER。34 个测试通过，API 鉴权 / 空间隔离 / 缺失对象均有证据。Chrome 三数据源在 1440×1000、760×844、390×844 完成结构 / 搜索 / 空状态 / 引用表跳转 / 只读 DDL / 复制 / 下载 / 刷新 / 视图流程，无浏览器错误。

## 范围与验收规则

- **开发效率**：依照用户要求，无依赖模块由多 agent 并行实现，约定契约及互斥文件范围；开发阶段只做必要 P0 功能 / 安全检查与一次实际视觉验收。完整跨驱动 / 入口 / 权限矩阵集中在阶段末尾，已有通过证据不因例行提交反复全量回归；新错误及代码修复仍做定向复核。最终阶段验收前不标记完整任务完成。

- **全量范围**：DBX 本地源码和中文产品文档中已实现且可使用的桌面、Web、CLI、MCP、插件、驱动与专项工作台能力；包括下文 81 个驱动类型与 104 个连接 Profile。实验性、默认关闭的能力也列入，并保留同等安全开关。不可把连接成功、静态演示、空按钮或仅有 UI 当作完成。
- **功能等价**：按 DBX 的 capability、数据库类型、运行入口和账号权限逐项验收。DBX 本身没有声明的能力不强行开放；不同版本/Edition/驱动的动态差异要保留。桌面特有功能可用 Tauri 桥接，Web 的文件路径与网络按服务器环境解释。
- **Fouc 架构**：React/Next.js 实现 UI，设备侧连接与执行归 `backend/device/`，账户、工作空间与共享业务归 `backend/server/`，公开契约置于 `shared/`，Tauri v2 只保留系统薄壳。DBX 的 Rust/Vue/Go 实现是行为与算法参考，迁移前记录许可证与第三方依赖；不把业务逻辑搬入 Fouc Rust 壳。
- **视觉优先级**：用户要求将前端视觉作为重点；持续对照固定 DBX 的截图、资源树、文档标签、SQL / 结果区和专项工作台，按 Fouc 主题令牌统一排版、字号、密度与状态反馈。功能通过不代替视觉验收，须检查真实内容下的桌面 / 窄屏、浅色 / 深色及可访问操作。本会话复用常驻 dev Web / 设备 / 业务服务，不构建 Tauri。
- **任务完成定义**：每行须具备真实后端通路、前端交互及加载/空/错误/取消/成功反馈、只读和生产保护、适用数据库矩阵验证、桌面及 Web 适用入口验证、必要的集成测试。数据库专属任务用对应服务实例或可重复的协议测试验证。**一行中用顿号、斜杠或分号列出的能力必须逐项留证**，不能只验收其中一个按钮或一种数据库。功能与 DBX 有意差异时记录差异和验收依据。
- **依赖顺序**：`F00 → F01/F02/F03/F04 → C/S/Q/G → D/X/A/P/R`；任务可并行，但不得用一个通用模拟驱动宣称完成全部类型。MySQL、PostgreSQL、SQLite 已复用原生关系型会话与共享工作台；旧 MySQL 演示和无空间会话路由已移除。所有尚未验收的能力仍按逐项矩阵推进。

## 核心功能覆盖复核（2026-09-24）

对照 DBX 当前源码的桌面组件目录、`dbx-core`/CLI/MCP/Web 模块、中文功能文档和驱动/Profile 清单，**本表已覆盖大部分核心功能类别**。这表示计划范围覆盖，不表示 Fouc 已实现或已验证。复核中把容易被大任务描述掩盖的细节补入 S02、S07、G01、A05、X01、X02；后续验收仍按行内子能力逐项留证。

| DBX 核心域 | 计划入口 | 复核结论 |
| --- | --- | --- |
| 连接、网络、凭据、保护与驱动 | F01–F08、C01–C08、R01–R81 和 104 个 Profile | 范围覆盖；真实驱动、动态能力与全入口安全仍待实现 |
| 对象树、对象/结构浏览、文档与图 | S01–S08、P08–P09 | 范围覆盖；新增树批量操作与文档笔记的逐项验收 |
| SQL 编辑、执行、计划、历史与文件 | Q01–Q10 | 范围覆盖；须按方言和结果类型验证，不以编辑器外观代替执行能力 |
| 表格、编辑、过滤、复杂值与导出 | G01–G11 | 范围覆盖；新增密度、来源和字段注释验收，写入需真实目标行识别 |
| 导入、迁移、比较、备份与生成 | D01–D09 | 范围覆盖；大任务中的格式、恢复、部分失败分别留证 |
| AI、MCP、CLI 与 Web API | A01–A09、F03、F07、P10 | 范围覆盖；新增 CLI 诊断、直连/桥接/Web 模式验收 |
| Redis、MongoDB 与其他专项工作台 | X01–X16 | 范围覆盖；新增 Redis MONITOR/消费组与 MongoDB 类型往返验收 |
| 插件、设置、发布与文档 | P01–P10、F06 | 范围覆盖；实验性或默认关闭能力按 DBX 实际开关验收 |

**覆盖边界**：现有矩阵是任务级范围索引，不是逐按钮的测试结果；特别是 81 个驱动的能力位与 104 个 Profile 均需在实施时生成真实服务/协议夹具证据。源码中存在未确认可从产品入口使用的组件或内部模块时，先核实可用性再扩展范围，不把仅有文件存在当作已交付功能。

## 0. 清点、契约与平台底座

| ID | 任务 / 可验收交付 | DBX 对照 | 状态 |
| --- | --- | --- | --- |
| F00 | 固定 DBX 源码版本，逐条建立「功能 × 数据库 × 桌面/Web/CLI/MCP」验收矩阵，记录已实现/受限/实验性状态；本文所有任务有负责人、状态、证据链接与回归用例。 | `docs/content/docs/`、`plugins/connection-types/`、`crates/dbx-core/assets/database-drivers.manifest.json` | 已完成 |
| F01 | 建立 Fouc 连接、能力、对象、查询结果、任务进度、错误和权限的共享 TypeScript 契约；UI 只按后端实际 capability 显示操作。 | `crates/dbx-core/src/models/`、`crates/dbx-drivers/` | 进行中 |
| F02 | 在 Bun sidecar 实现驱动注册、生命周期、连接池/单连接、超时、取消、自动重连、元数据缓存/失效、长任务和流式结果；隔离各连接。 | `crates/dbx-core/src/connection/`、`query/`、`schema/` | 进行中 |
| F03 | 桌面 HTTP/WS 桥与 Web API/SSE 共用服务层；鉴权、会话、下载、进度、错误语义一致，Web 服务可部署。 | `crates/dbx-web/src/`、`src-tauri/src/commands/` | 待实施 |
| F04 | 将 DBX 能力标记、SQL 方言和连接 Profile 转为 Fouc 单一目录源；启动时校验 Profile→驱动→能力映射，未知/缺失能力不误开放。 | `plugins/connection-types/`、`plugins/dialects/` | 进行中 |
| F05 | 引入可重复的数据库测试矩阵、容器/测试服务、协议夹具和桌面/Web 端到端用例；每个驱动至少验证连接、故障、声明能力和只读阻断。 | `crates/*/tests/`、`apps/desktop/src/**/__tests__/` | 进行中 |
| F06 | 审核 DBX Apache-2.0、复用代码/素材、第三方驱动与插件许可证；保留所需 NOTICE 和依赖清单。 | `opensource/dbx/LICENSE`、`agents/`、`plugins/` | 待实施 |
| F07 | Web 首次设置、登录/登出、修改密码、会话 Cookie、API 鉴权与部署在子路径时的路由；桌面本地访问和 Web 登录边界分别验收。 | `crates/dbx-web/src/auth.rs`、`components/auth/LoginPage.vue` | 待实施 |
| F08 | 为主要数据库及版本建立可重复的本地测试实验室：容器配方、健康检查、冒烟数据、连接字段输出、端口冲突检查与一键验证；作为 Rxx 验收基础。 | `docs/content/docs/database-lab.cn.mdx`、`opensource/dbx/deploy/` | 进行中 |

## 1. 连接、网络、配置与安全

| ID | 任务 / 可验收交付 | DBX 对照 | 状态 |
| --- | --- | --- | --- |
| C01 | 迁移全部 104 个 Profile 的分类、搜索、默认字段、图标、默认端口、URL 模板、特色选项与动态表单；增删改复制、测试、最近/置顶/分组/颜色完整闭环。 | `plugins/connection-types/profiles/catalog.yaml`、`components/connection/` | 进行中 |
| C02 | 支持 URL/DSN 解析与反向填表、多认证方式、TLS/CA/客户端证书、超时与连接参数；敏感项与普通配置分离。 | `plugins/connection-types/*.yaml`、`connection/` | 进行中 |
| C03 | SSH 隧道、跳板/密钥/口令提示、SSH config 导入、隧道 Profile、SOCKS5、HTTP 代理/隧道、网络失败诊断和安全关闭。 | `components/ssh/`、`tunnel_profiles.rs`、`ssh-tunnel.cn.mdx` | 待实施 |
| C04 | 本地凭据安全存储、解锁和密码提示；配置导出 AES-GCM 加密、导入/合并/冲突处理，支持从 DBeaver、Navicat、DataGrip 导入连接。 | `connection_secrets.rs`、`keychain.rs`、`config_cmd.rs`、`connection-import.cn.mdx` | 进行中 |
| C05 | 连接与数据库级只读、写入解锁、SQL/命令风险分类、每次生产写入确认、危险语句/目标组保护；所有 UI、CLI、MCP 和专项 API 走同一策略。 | `crates/dbx-core/src/safety/`、`crates/dbx-sql/src/` | 进行中 |
| C06 | 写入前 SQL/请求预览、影响范围和失败反馈；事务提交/回滚、部分成功标识、取消行为，不以客户端禁用按钮代替服务端拦截。 | `production-safety.cn.mdx`、`query/two_phase_commit.rs` | 进行中 |
| C07 | Agent/JDBC/外部驱动下载、安装、版本/运行时检测、更新/卸载、缺失提示和驱动商店；系统/托管/多版本 JRE、离线 ZIP/JRE 包导入、运行时 PID/CPU/内存/Session 监控及停止/重启；兼容各驱动的 Agent 进程协议。 | `agents/`、`driver-management.cn.mdx` | 待实施 |
| C08 | 连接设置和 SQL 库的 WebDAV/Gist/Gitee 同步、冲突处理、手动/自动同步状态及恢复。 | `cloud_sync.rs`、`cloud-sync.cn.mdx` | 待实施 |

## 2. 工作台壳、导航与对象资源

| ID | 任务 / 可验收交付 | DBX 对照 | 状态 |
| --- | --- | --- | --- |
| S01 | 在 Fouc 公共顶栏/导航内实现可折叠数据库资源栏、主区和 AI/信息详情右栏；多标签、拆分/分组、拖拽、关闭确认、标签恢复与独立窗口行为。 | `components/layout/`、`tabs/` | 进行中 |
| S02 | 连接→数据库→Schema→表/视图/字段/索引/外键/触发器等树；异步展开/全展开/全折叠、搜索过滤与可见范围（隐藏系统 Schema/前缀）、计数、刷新、固定/粘性行、标签反向定位、权限/错误提示和上下文菜单；嵌套连接分组、多选批量管理、对象复制粘贴及拖入 SQL 编辑器逐项验收。 | `components/sidebar/`、`schema-browser.cn.mdx` | 进行中 |
| S03 | 全局快速打开/搜索与数据库对象搜索，跨连接、数据库、Schema 的命中定位和打开。 | `components/quick-open/`、`search/`、`global_search.rs` | 进行中 |
| S04 | 对象浏览器覆盖表、视图、过程、函数、序列、事件、扩展、类型及特定数据库对象；列表、详情、源码/DDL、创建/修改/删除及能力门控。 | `components/objects/`、`object-browser.cn.mdx` | 进行中 |
| S05 | 表结构视图和编辑：列、主键、索引、约束、外键、注释、存储选项，生成/预览 DDL；SQLite 重建等方言特例正确处理。 | `components/structure/`、`schema/table_structure_sql.rs` | 进行中 |
| S06 | ER 图、表间关系、布局、搜索/缩放/导出；字段血缘、上下游依赖和字段来源解释。 | `components/diagram/`、`lineage/` | 进行中 |
| S07 | 数据库文档快照、双向关系、表/字段 Markdown 笔记与彩色分组、自动保存/失败重试、本地笔记和数据库注释并存、DBML/文档导出与刷新；孤儿笔记、缺失元数据及不支持 DBML 的结构明确告警；支持 CLI/MCP 同源文档上下文。 | `crates/dbx-core/src/data/docs/`、`database-docs.cn.mdx` | 进行中 |
| S08 | 数据库/Schema 创建与管理、对象复制/粘贴、跨库作用域、菜单权限和危险操作确认。 | `components/objects/`、`schema/` | 进行中 |

## 3. SQL 编辑、执行与结果分析

| ID | 任务 / 可验收交付 | DBX 对照 | 状态 |
| --- | --- | --- | --- |
| Q01 | SQL 编辑器语法高亮、方言切换、元数据补全、括号/缩进、诊断、主题、快捷键及选中/当前语句/全文件执行；中文输入与选区显示正常。 | `components/editor/`、`query-editor.cn.mdx` | 进行中 |
| Q02 | SQL 格式化、快速操作、参数输入、SQL snippet/模板/SQL 库、搜索、保存/打开/重命名、SQL 文件树及标签恢复。 | `sql-formatter.cn.mdx`、`sql-snippets.cn.mdx`、`saved_sql.rs` | 进行中 |
| Q03 | 查询目标连接/数据库/Schema 切换，多目标组执行、单/多结果导航、消息、受影响行、耗时、可取消执行、异常定位及历史重跑。 | `components/layout/SqlEditorWorkspace.vue`、`query.rs`、`history.rs` | 进行中 |
| Q04 | SQL 风险诊断、执行计划/Explain 可视化、优化提示、目标环境提示与可审查执行入口。 | `components/explain/`、`crates/dbx-sql/src/` | 进行中 |
| Q05 | 查询历史、收藏/保存、搜索过滤、执行时间/目标/状态；保留可恢复的编辑内容和连接上下文。 | `historyStore.ts`、`history.rs` | 进行中 |
| Q06 | 大 SQL 文件预览、编码/路径校验、分段执行、进度、失败定位/重试/取消；SQL 文件导入/恢复与 ZIP 包。 | `components/sql-file/`、`data/sql_file_import.rs` | 进行中 |
| Q07 | 查询结果的表格、文本、JSON、图表/指标切换；图表维度/指标配置、结果复制和导出。 | `components/chart/`、`QueryResultViewSwitcher.vue` | 进行中 |
| Q08 | SQL 方言解析、标识符引用、日期/二进制/NULL 格式、只读/可编辑结果判定、语句拆分及多数据库特例。 | `crates/dbx-sql/`、`crates/dbx-formats/` | 进行中 |
| Q09 | 编辑器悬停提示、代码折叠、别名/CTE/JOIN 补全、`Ctrl/Cmd+Click` 对象跳转；占位符 `?`、`:name`、`${name}`、`#{name}`、`@name` 与 `@set` 输入；执行范围选择器和「在新结果中执行」。 | `query-editor.cn.mdx`、`components/editor/` | 进行中 |
| Q10 | 对 `INSERT/UPDATE/DELETE` 提供执行前变更预览：只读改写、旧/新值对照、受影响行展示；无法安全改写时明确拒绝预览而不误报执行结果。 | `query-editor.cn.mdx`、`crates/dbx-sql/src/` | 进行中 |

## 4. 数据表格与数据编辑

| ID | 任务 / 可验收交付 | DBX 对照 | 状态 |
| --- | --- | --- | --- |
| G01 | 真实表数据按页/虚拟滚动加载、行号、斑马纹、空值/类型展示、列宽行高拖拽、自适应少列填满、宽表横向滚动；字体/字号/行高/密度设置和连接、结果来源、字段类型/注释信息可见。 | `components/grid/`、`data-grid.cn.mdx` | 进行中 |
| G02 | 单格、连续矩形、多行/列选择；键盘导航、复制/粘贴、上下文菜单、选择状态与右侧详情同步，首次打开不预选。 | `components/grid/` | 进行中 |
| G03 | 分清数据库侧 WHERE/ORDER BY 与客户端的当前结果搜索、值过滤、当前页排序；提供列筛选、LIKE/NOT LIKE、多字段排序、刷新/重置、页大小与分页，并明确显示条件的执行位置与范围。 | `components/grid/`、`data-grid.cn.mdx` | 进行中 |
| G04 | 单元格编辑、批量改单元格、新增/复制/删除行、脏数据标记、撤销/回滚、提交前 SQL 预览与冲突/部分失败反馈。 | `components/grid/`、`crates/dbx-sql/src/` | 进行中 |
| G05 | 单元格/行/列详情、字段元数据、关联数据跳转、值大文本查看、行详情动态展示与字段筛选。 | `components/grid/`、`components/objects/` | 进行中 |
| G06 | CSV、TSV、JSON、Markdown、XLSX、INSERT SQL 的选择/全表复制及导出；大结果分片/ZIP、进度/取消和正确转义。 | `crates/dbx-formats/`、`table_export.rs` | 进行中 |
| G07 | 表结构筛选、列显示/隐藏/固定、自动适宽、数据/结构工具栏、Canvas 编辑模式和上下文操作完整可用。 | `components/grid/` | 进行中 |
| G08 | 转置视图、列头拖拽排序、左右冻结、字段注释搜索、表/查询级布局记忆与重置、自动刷新和多次运行结果固定；未提交编辑时防止自动刷新覆盖。 | `data-grid.cn.mdx`、`useDataGridAutoRefresh.ts`、`useDataGridColumnLayout.ts` | 进行中 |
| G09 | 列格式化器（日期/时间、JSON 路径、掩码、模板）、选择区数量/求和摘要、复制为批量 INSERT/UPDATE、可选注释表头与标识符引用；显示格式不改变原始值。 | `data-grid.cn.mdx`、`useDataGridColumnFormatter.ts` | 进行中 |
| G10 | 复杂值详情支持长文本/JSON、二进制十六进制与 ASCII、图像、日期时区、空间数据与 SRID；编辑时区分 NULL、空字符串、默认值和生成值。 | `data-grid.cn.mdx`、`useDataGridLargeValues.ts` | 进行中 |
| G11 | MySQL 单字段按 WHERE 跨未加载分页批量更新：条件构造、预计影响行数、完整 SQL 确认与实际影响行反馈；不得伪装成可可靠回滚的逐行编辑。 | `data-grid.cn.mdx`、`components/grid/` | 待实施 |

## 5. 导入、传输、差异、备份

| ID | 任务 / 可验收交付 | DBX 对照 | 状态 |
| --- | --- | --- | --- |
| D01 | CSV/TSV/自定义分隔文本、JSON、XLS/XLSX/XLSM、字面量 INSERT SQL 的预览与导入；编码、行范围、空值/空白、工作表、字段映射与类型推断；现有表追加/清空或多文件多工作表批量建表，逐任务进度、部分成功与取消。 | `components/import/`、`data/table_import.rs`、`table-import.cn.mdx` | 进行中 |
| D02 | 跨连接/跨引擎数据传输：源目标映射、类型转换、建表/清表/追加、批量流式处理、进度/失败重试/断点与任务记录。 | `components/transfer/`、`data/transfer.rs` | 进行中 |
| D03 | 数据比较与同步：键列选择、差异行、字段映射、冲突矩阵、修改预览、选择性同步与风险提示。 | `components/diff/DataCompareDialog.vue`、`data/data_compare.rs` | 进行中 |
| D04 | Schema diff：对象树、差异/DDL、依赖排序、选项、影响报告、部署/回滚或重试；原生在线结构变更/OSC 仅在适用驱动开放。 | `components/diff/SchemaDiff*`、`schema_diff.rs` | 进行中 |
| D05 | 数据库/表结构与数据导出、SQL 脚本生成、格式选择、拆分包、进度/取消；区分轻量导出与数据库原生备份。 | `data/database_export.rs`、`script_generator.rs` | 进行中 |
| D06 | SQLite 备份、MongoDB dump/import/export；MySQL/PostgreSQL 桌面一次性与小时/日/周定时逻辑备份，库/表模式、结构/数据/对象、路径模板、只读一致性快照、保留/历史/取消清理和 MySQL 指定表恢复。 | `sqlite_backup.rs`、`mongodb_dump.rs`、`components/backup/`、`database-backup.cn.mdx` | 进行中 |
| D07 | 桌面文件拖放生成 DuckDB 文件查询及 CSV/JSON/Parquet 读取入口；Web 上传与服务器路径、临时文件清理分别处理。 | `useFileDrop.ts`、`buildDroppedFilePreviewSql` | 待实施 |
| D08 | 传输、导入、导出任务持久化与重新打开；文件下载校验、出错详情、取消和完成通知。 | `transferTaskStore.ts`、`crates/dbx-web/src/routes/` | 待实施 |
| D09 | 测试数据生成：按字段配置姓名、地址、日期、数字、枚举、正则、外键等生成器，预览、批量写入、进度和生产写入保护。 | `components/generate/` | 进行中 |

## 6. AI 与自动化入口

| ID | 任务 / 可验收交付 | DBX 对照 | 状态 |
| --- | --- | --- | --- |
| A01 | 右侧 AI Ask/Agent：当前连接/Schema/选区上下文、流式对话、生成/解释/优化/修复 SQL、复制或送回编辑器。 | `components/ai/`、`ai-assistant.cn.mdx` | 待实施 |
| A02 | 模型配置覆盖 Claude、OpenAI、Gemini、DeepSeek、Qwen、MiniMax、Ollama、OpenAI/Anthropic Compatible、Custom；模型发现、API 风格、认证、代理、自定义请求头、推理强度/Thinking、凭据管理、连通测试与多配置切换。 | `crates/dbx-ai-provider/`、`ai_multi_config.rs`、`ai-assistant.cn.mdx` | 待实施 |
| A03 | Agent 工具调用、只读 Ask 和受控执行、生产写入人工审查、会话历史、取消、错误恢复和用量/结果反馈。 | `crates/dbx-core/src/ai/`、`components/ai/` | 待实施 |
| A04 | MCP stdio/HTTP 服务：连接/结构/文档/查询/专项资源与工具；连接白名单、库/资源作用域、只读/读写/完全访问三级权限、认证和会话。 | `crates/dbx-mcp/`、`mcp_policy.rs` | 进行中 |
| A05 | CLI：`doctor`/`capabilities` 诊断、列连接/库/表、描述结构、查询、上下文/DBML 文档导出、表打开 Deep Link；本机直连与桌面桥、Web 远程模式、默认连接；Table/JSON/CSV 稳定输出与非零错误码、超时/行数/文件、写入/危险操作显式参数。 | `crates/dbx-cli/`、`cli.cn.mdx` | 进行中 |
| A06 | 桌面 Deep Link 与外部 AI/脚本唤起目标连接、表、SQL 标签；错误目标与权限反馈。 | `deep_link.rs`、`launch_args.rs` | 待实施 |
| A07 | 桌面本地 CLI Agent（Claude Code、Codex、Pi，及源码已接入的其他 CLI）路径/环境配置、受限 MCP 桥；Agent 轮次/重试、`@` 表与 SQL 文件上下文、全局指令/多模板快照、按连接历史和 Markdown 导出。Web 隐藏仅适用本机的 CLI 入口。 | `crates/dbx-ai-provider/src/`、`ai-assistant.cn.mdx` | 待实施 |
| A08 | MCP 工具逐项对齐 DBX 清单：连接增删复制、库/表/例程/源码/Schema 文档、SQL/Redis/Mongo/消息队列、桌面打开/展示；实现批量 SQL、固定连接会话与 MySQL 显式事务、回滚/未知结果处理、工具/连接/库/资源作用域。 | `crates/dbx-mcp/`、`mcp.cn.mdx` | 进行中 |
| A09 | MCP Desktop 与 Web Streamable HTTP/stdio 入口，默认关闭本机 HTTP、Bearer Token 轮换、Host/Origin 白名单、远程访问显式启用与异常重启；CLI/MCP 安装包和跨平台分发。 | `mcp_http_server.rs`、`crates/dbx-mcp/`、`mcp.cn.mdx` | 进行中 |

## 7. 非 SQL 专项工作台

| ID | 任务 / 可验收交付 | DBX 对照 | 状态 |
| --- | --- | --- | --- |
| X01 | Redis：库/Key 前缀与类型浏览、String/Hash/List/Set/ZSet/Stream 等查看编辑、TTL、命令台与历史、PubSub、Dashboard/Key 统计/Slowlog、Stream 消费组/Pending/Lag、批量 Key/TTL 操作、危险命令保护；独立连接的实时 `MONITOR` 含停止/关闭释放、记录上限和 Sentinel/Cluster 限制。 | `components/redis/`、`redis_cmd.rs`、`redis.cn.mdx` | 进行中 |
| X02 | MongoDB：库/集合/文档 CRUD、筛选/排序/分页/聚合、索引、JSON 编辑、GridFS、导入导出与 dump；CSV 嵌套字段路径/数组索引和 ObjectId 类型识别、JSON/NDJSON Extended JSON 往返、采样推断与字段映射逐项验收。 | `components/document/`、`mongo_cmd.rs`、`mongodb.cn.mdx` | 进行中 |
| X03 | Elasticsearch/Easysearch/Meilisearch/Manticore：索引/文档/Schema 浏览、搜索/原始请求、响应与 Profile 视图、适用的写入。 | `components/meilisearch/`、`Elasticsearch*` | 待实施 |
| X04 | Qdrant/Milvus/Weaviate/ChromaDB：集合/维度/Schema、Top-K 检索、请求预览、Upsert、删除及引擎专属参数。 | `components/vector/`、`vector_cmd.rs` | 待实施 |
| X05 | HBase：Namespace、表、Column Family、Row Key/范围扫描、行数据和结构管理；限制大扫描。 | `components/hbase/`、`hbase_cmd.rs` | 待实施 |
| X06 | Pulsar：Tenant/Namespace/Topic、订阅、消息、生产者/消费者、管理策略/权限/配额、监控和 Raw API。 | `components/mq/`、`admin/mq/` | 待实施 |
| X07 | Kafka：Broker/Topic/Partition、Consumer Group、消息读取/发送、配置/监控与实际 capability 门控。 | `components/mq/`、`admin/mq/` | 待实施 |
| X08 | RocketMQ：Topic/Group、消息查询/发送/轨迹、Broker/客户端及适用管理 API。 | `components/mq/`、`admin/mq/` | 待实施 |
| X09 | RabbitMQ：Virtual Host、Exchange/Queue/Binding、消息、连接/Channel、Policy/Permission 与管理 API。 | `components/mq/`、`admin/mq/` | 待实施 |
| X10 | MQTT：Broker 连接、Topic 订阅/发布、消息视图、会话/连接状态及协议参数。 | `components/mqtt/`、`mqtt_cmd.rs` | 待实施 |
| X11 | etcd：Key 前缀搜索/CRUD、Lease/Watch、成员/健康/指标 Dashboard、用户角色 ACL。 | `components/etcd/`、`etcd_cmd.rs` | 待实施 |
| X12 | ZooKeeper：ZNode 树、数据/Stat、创建修改删除、节点 ACL 与连接状态。 | `components/zookeeper/`、`zookeeper_cmd.rs` | 待实施 |
| X13 | Nacos：配置/Namespace/服务/实例、搜索、历史/对比/回滚、批量导入导出/复制、Dashboard 与 Raw API。 | `components/nacos/`、`nacos_cmd.rs` | 待实施 |
| X14 | Consul 概览/能力探测、KV 搜索与 CAS/事务/Watch/导入导出/跨域迁移；保留 64 操作事务限制与分批非原子反馈。 | `components/consul/`、`consul_cmd.rs` | 待实施 |
| X15 | Consul Catalog/Health、Agent Service/Check、Session/Lock、ACL、Enterprise Namespace/Partition、Service Mesh、工具/Operator；敏感值一次展示，危险 Operator 功能分项默认关闭。 | `components/consul/`、`specialized-workspaces.cn.mdx` | 待实施 |
| X16 | DynamoDB、Neo4j、时序/图数据库及仅 browse/understand 的驱动：使用对应对象模型展示查询/记录，不错误套用 SQL 表格或开放未声明写入。 | `plugins/connection-types/`、`database-drivers.manifest.json` | 待实施 |

## 8. 数据库管理、插件、设置与发布

| ID | 任务 / 可验收交付 | DBX 对照 | 状态 |
| --- | --- | --- | --- |
| P01 | MySQL/PostgreSQL/Xugu 等 Dashboard、进程/会话、SQL Server 活动跟踪及对应数据库专属管理面板。 | `components/admin/` | 进行中 |
| P02 | 用户/角色/权限管理，达梦用户/角色/Job、Oracle DB Link、PostgreSQL 扩展、MySQL Event 等专属对象操作。 | `components/admin/`、`components/objects/` | 进行中 |
| P03 | DBX 插件包 `.dbxp` 的安装/启停/卸载、签名和哈希验证、市场目录、版本/更新、权限隔离、Host API 与插件日志。 | `crates/dbx-plugin-runtime/`、`plugins/` | 待实施 |
| P04 | 插件贡献点：自定义连接/Profile/字段/对象/工作台/侧栏/文件提供者，前端宿主与 sidecar 插件运行时按权限通信。 | `components/plugins/`、`plugin-development.cn.mdx` | 待实施 |
| P05 | 设置：主题/暗色模式、9 种编辑器主题、语言（中/英/西）、快捷键、网格偏好、布局状态和外观资源。 | `components/settings/`、`settingsStore.ts` | 待实施 |
| P06 | 桌面自动更新、变更日志、版本/诊断/支持信息、崩溃或连接错误排查；Web 部署文档与容器构建。 | `host/update.rs`、`components/layout/UpdateDialog.vue`、`deploy/` | 待实施 |
| P07 | 专项系统及各 SQL 方言的用户文档、能力矩阵、快捷键、Web API/CLI/MCP/插件开发文档同步到 Fouc。 | `docs/content/docs/` | 待实施 |
| P08 | Dolt 分支/提交/修订选择、版本差异、表与单元格 diff、分页和版本控制操作；只在 Dolt Profile 启用。 | `components/dolt/` | 待实施 |
| P09 | 对象/Schema 代码快照、差异查看与导出，保持快照来源、时间和目标上下文可追溯。 | `components/codeSnapshot/` | 待实施 |
| P10 | Web 部署的首次初始化、登录安全、容器持久化、反向代理/子路径、1Panel 部署和升级验证；发布 CLI/MCP/桌面安装包与对应平台运行时。 | `crates/dbx-web/`、`deploy/`、`1panel.cn.mdx` | 待实施 |

## 9. 驱动与连接 Profile 覆盖矩阵

下面每个 `Rxx` 都是**独立交付与验收任务**，不是共享连接表单的一次性勾选。列中的运行模式与级别来自 DBX manifest；`operate / understand / browse / connect` 是 DBX 原标记，须以 manifest 逐项能力位、专项 UI 和实际服务端权限作最终验收。`agent` 类型还依赖 C07。Profile 单列在末尾；同一驱动的多个 Profile 必须逐个验证默认字段、图标、连接模板和服务器版本差异。MQ 的四个协议 Profile 在 X06–X09 独立验收。驱动矩阵来源：`opensource/dbx/crates/dbx-core/assets/database-drivers.manifest.json`。

| ID | DBX 驱动类型 | 运行模式 | 支持级别 | 验收范围 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| R01 | `mysql` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, sqlExplain, userAdmin | 进行中 |
| R02 | `postgres` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, sqlExplain, userAdmin | 进行中 |
| R03 | `sqlite` | file | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage | 进行中 |
| R04 | `rqlite` | native | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage | 待实施 |
| R05 | `turso` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage | 待实施 |
| R06 | `cloudflare-d1` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage | 待实施 |
| R07 | `redis` | native | connect | queryExecution | 进行中 |
| R08 | `duckdb` | file | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, driverManagement | 待实施 |
| R09 | `clickhouse` | native | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate | 待实施 |
| R10 | `sqlserver` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, sqlExplain | 待实施 |
| R11 | `mongodb` | agent | connect | queryExecution, objectBrowser, dataTransfer | 进行中 |
| R12 | `dynamodb` | native | operate | metadataBrowse, tableDataEdit | 待实施 |
| R13 | `oracle` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage, sqlExplain, driverManagement | 待实施 |
| R14 | `elasticsearch` | native | connect | queryExecution | 待实施 |
| R15 | `easysearch` | native | connect | queryExecution | 待实施 |
| R16 | `meilisearch` | native | browse | queryExecution, metadataBrowse | 待实施 |
| R17 | `hbase` | native | operate | metadataBrowse, tableDataEdit | 待实施 |
| R18 | `qdrant` | native | browse | queryExecution, metadataBrowse | 待实施 |
| R19 | `chromadb` | native | browse | queryExecution, metadataBrowse | 待实施 |
| R20 | `milvus` | native | browse | queryExecution, metadataBrowse | 待实施 |
| R21 | `weaviate` | native | browse | queryExecution, metadataBrowse | 待实施 |
| R22 | `doris` | native | operate | queryExecution, metadataBrowse, objectBrowser, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, databaseCreate, sqlExplain, userAdmin | 待实施 |
| R23 | `starrocks` | native | operate | queryExecution, metadataBrowse, objectBrowser, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, databaseCreate, userAdmin | 待实施 |
| R24 | `manticoresearch` | native | operate | queryExecution, metadataBrowse, tableDataEdit, tableStructureEdit, sqlFileExecution | 待实施 |
| R25 | `redshift` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, databaseCreate, fieldLineage | 待实施 |
| R26 | `dameng` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage, sqlExplain, driverManagement | 待实施 |
| R27 | `kingbase` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, userAdmin, driverManagement | 待实施 |
| R28 | `highgo` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, userAdmin, driverManagement | 待实施 |
| R29 | `uxdb` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, driverManagement | 待实施 |
| R30 | `vastbase` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, userAdmin, driverManagement | 待实施 |
| R31 | `goldendb` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, userAdmin, driverManagement | 待实施 |
| R32 | `databend` | agent | operate | queryExecution, metadataBrowse, objectBrowser, tableDataEdit, tableStructureEdit, sqlFileExecution, databaseCreate, driverManagement | 待实施 |
| R33 | `gaussdb` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, userAdmin | 待实施 |
| R34 | `kwdb` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, userAdmin | 待实施 |
| R35 | `yashandb` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, databaseCreate, driverManagement | 待实施 |
| R36 | `databricks` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement | 待实施 |
| R37 | `saphana` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement | 待实施 |
| R38 | `teradata` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement | 待实施 |
| R39 | `vertica` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement | 待实施 |
| R40 | `firebird` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement | 待实施 |
| R41 | `exasol` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement | 待实施 |
| R42 | `opengauss` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, dataTransfer, sqlFileExecution, databaseCreate, fieldLineage, userAdmin | 待实施 |
| R43 | `questdb` | native | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, sqlExplain | 待实施 |
| R44 | `oceanbase-oracle` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, dataTransfer, sqlFileExecution, fieldLineage, sqlExplain, driverManagement | 待实施 |
| R45 | `gbase` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement | 待实施 |
| R46 | `access` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableDataEdit, tableStructureEdit, tableImport, sqlFileExecution, driverManagement | 待实施 |
| R47 | `h2` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, tableStructureEdit, dataTransfer, sqlFileExecution, driverManagement | 待实施 |
| R48 | `snowflake` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, databaseCreate, driverManagement | 待实施 |
| R49 | `trino` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, driverManagement | 待实施 |
| R50 | `prestosql` | external | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution | 待实施 |
| R51 | `hive` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, dataTransfer, sqlFileExecution, driverManagement | 待实施 |
| R52 | `argo` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, tableDataEdit, dataTransfer, sqlFileExecution, driverManagement | 待实施 |
| R53 | `kyuubi` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, dataTransfer, sqlFileExecution, sqlExplain, driverManagement | 待实施 |
| R54 | `impala` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, dataTransfer, sqlFileExecution, sqlExplain, driverManagement | 待实施 |
| R55 | `db2` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableDataEdit, sqlFileExecution, driverManagement | 待实施 |
| R56 | `informix` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement | 待实施 |
| R57 | `neo4j` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, driverManagement | 待实施 |
| R58 | `cassandra` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement | 待实施 |
| R59 | `bigquery` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, driverManagement | 待实施 |
| R60 | `spanner` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, driverManagement | 待实施 |
| R61 | `kylin` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement | 待实施 |
| R62 | `ignite` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement | 待实施 |
| R63 | `ignite3` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement | 待实施 |
| R64 | `sundb` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement | 待实施 |
| R65 | `oscar` | agent | browse | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, tableDataEdit, tableStructureEdit, sqlFileExecution, driverManagement | 待实施 |
| R66 | `tdengine` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, sqlFileExecution, databaseCreate, driverManagement | 待实施 |
| R67 | `xugu` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, diagram, tableStructureEdit, tableImport, sqlFileExecution, driverManagement | 待实施 |
| R68 | `etcd` | agent | connect | queryExecution, schemaSearch, driverManagement | 待实施 |
| R69 | `zookeeper` | agent | connect | driverManagement | 待实施 |
| R70 | `nacos` | native | connect | 专项工作台 / 连接能力；按源码验收 | 待实施 |
| R71 | `consul` | native | connect | 专项工作台 / 连接能力；按源码验收 | 待实施 |
| R72 | `mq` | native | connect | metadataBrowse, objectBrowser, driverManagement | 待实施 |
| R73 | `mqtt` | native | connect | 专项工作台 / 连接能力；按源码验收 | 待实施 |
| R74 | `iotdb` | agent | understand | queryExecution, metadataBrowse, objectBrowser, schemaSearch, sqlFileExecution, driverManagement | 待实施 |
| R75 | `iris` | agent | operate | queryExecution, metadataBrowse, objectBrowser, objectSource, schemaSearch, diagram, tableStructureEdit, sqlFileExecution, driverManagement | 待实施 |
| R76 | `influxdb` | agent | connect | queryExecution, metadataBrowse, objectBrowser, sqlFileExecution, databaseCreate | 待实施 |
| R77 | `influxdb3` | native | connect | queryExecution, metadataBrowse, objectBrowser, sqlFileExecution | 待实施 |
| R78 | `victoriametrics` | native | browse | queryExecution, metadataBrowse, objectBrowser, sqlFileExecution | 待实施 |
| R79 | `jdbc` | external | browse | queryExecution, metadataBrowse, objectBrowser, sqlFileExecution | 待实施 |
| R80 | `spark` | agent | operate | queryExecution, metadataBrowse, objectBrowser, schemaSearch, tableDataEdit, dataTransfer, sqlFileExecution, driverManagement | 待实施 |
| R81 | `plugin` | external | connect | 专项工作台 / 连接能力；按源码验收 | 待实施 |

### Profile 逐项验收清单

Profile 来源：`opensource/dbx/plugins/connection-types/profiles/catalog.yaml`。每个 Profile 均须验证 C01/C02 与对应 Rxx/Xxx；兼容协议别名不得遗漏。

| Profile | 对应驱动 | 类别 | 验收状态 |
| --- | --- | --- | --- | --- |
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
| `mongodb` | `mongodb` | document | 进行中 |
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

- [x] F00 已将本文件各行转换为可追踪任务并固定 DBX 源码版本；后续每行仍须提交 PR/测试/截图或录屏证据，并记录版本差异。
- [ ] 81 个 R 任务与 104 个 Profile 全部有真实连接验收记录；能力位为 true 的功能逐项通过，false 的操作不会错误显示。
- [ ] 桌面、Web、CLI、MCP 四入口的共享能力行为一致；平台专属能力有明确边界和提示。
- [ ] 只读、生产确认、Agent 执行和 MCP 权限不能被任意入口绕过；失败和取消可恢复。
- [ ] 导入/导出/备份/传输在大数据量、编码错误、网络中断和部分失败下通过回归。
- [ ] Fouc 公共组件与最终 MySQL 工作台 UX 保持一致；专项界面保留 DBX 功能且符合 Fouc 视觉系统。
- [ ] 文档与实际能力矩阵同步；所有功能任务实施后按仓库流程测试、提交。本会话保持开发服务常驻，Tauri 构建按用户后续明确要求执行。
