# Fouc 模型资料目录

## 所有权与执行边界

模型资料属于全产品公开参考目录，由 `backend/server/modules/models` 维护，访客和登录用户读取相同资料。目录没有账户、项目、知识库或工作空间分区；它不保存 API Key、用户余额、订阅权益或设备安装事实。列入目录不表示当前账户可以调用该模型。模型执行、供应商凭据与本机 Agent 探测仍分别授权，首页会话仍遵守[新对话设计](../conversations/fouc-new-conversation-design.md)的预览边界。

前端通过 `@fouc/shared/model-catalog` 的校验契约读取 `GET /api/models`，不运行时导入后端内部代码。接口公开且只读，不依赖登录 cookie；CORS 仅允许已配置的产品来源，不开放带凭据的访问。成功响应缓存 300 秒；数据库故障或存储数据不符合契约时返回可重试的 503，并禁止缓存错误响应。不提供客户端修改目录的 HTTP 接口。

## 当前数据模型

`catalog.model` 是独立的全局目录表，与 `auth`、项目和知识库的 `resources` 分开。业务运行角色仅有该 schema 的 USAGE 和表的 SELECT 权限，不能写入、清空、改表或创建对象；公开资料无需套用项目/知识库 RLS。统一数据库检查同时核对结构和只读授权。

| 字段 | 含义 |
| --- | --- |
| `id`、`provider`、`name` | 官方稳定型号、厂商和展示名；型号为主键 |
| `summary` | 中英文简述 |
| `context_window`、`max_output` | 已核实的 API 输入上下文和输出上限；不能精确核实则为 null |
| `capabilities` | 视觉输入、工具调用、推理、原生图像生成；明确支持/不支持/未知 |
| `pricing` | USD 每百万 token 的标准输入、输出、缓存读取及写入价；双语备注保留长上下文、时段、缓存期限、图片和工具等计费条件 |
| `benchmarks` | 原始公开测试名称、百分比成绩、双语条件和官方来源；不是主观能力评分 |
| `sources`、`verified_at` | 官方资料链接及人工核实日期 |

结构化嵌套字段用 typed JSONB，型号、厂商、名称、token 上限和日期使用普通列。当前只消费完整小目录，不提前拆出没有独立维护需求的厂商、价格历史或测评版本表。Drizzle 是唯一当前 schema 来源，生成 `current.sql`，不保留迁移链或旧开发数据兼容路径。

## 资料维护

首版收录 7 个已核实型号：Claude Haiku 4.5、Haiku 5.5、Sonnet 5.5、GPT-6.1 Sol、GPT-6 Luna、DeepSeek V4.1 Flash 和 Nano Banana 2。种子资料位于服务端 `modules/models/catalog-data.json`，核实日期为 2026-10-16。来源包括 [Anthropic 模型文档](https://platform.claude.com/docs/en/models/overview)、[OpenAI 模型文档](https://developers.openai.com/api/docs/models/gpt-6.1-sol)、[DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)及 [Google 模型 API 文档](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image)，各行另外保存直接支持其规格、价格和测评的页面。

不使用前端硬编码目录、不实时抓取供应商网页，也不把网页文本当作运行指令。新增或更新资料先人工核实官方模型 API、价格表及发布测评，修改服务端资料，再执行显式管理员导入。完整载荷必须通过共享 schema 和型号唯一性检查后才获取连接；替换在单个事务中完成，失败保留原目录。数据变更由 Git 与核实日期追溯。

运行命令使用 `bun --env-file=.env.fouc.local backend/server/scripts/models-catalog.ts init` 或 `import [catalog.json]`。`init` 只创建不存在的目录 schema 并写入种子，可用于已有独立业务库，不修改其他 schema；已有目录用 `import` 更新资料。空库的统一初始化同时建立目录。生产服务启动和普通 API 读取不创建表或写种子。

事实缺失不填 0、不插值、不从模型规模推断能力。OpenAI 两个型号暂未找到适用的公开百分比基准；Google 公布的 Elo 不强制归一化到百分比；DeepSeek API 仅写“1M”时不把模型配置值擅自当作精确 API 限额。价格不换算为未经定义的平台积分或倍率。不同测评、工具设置和脚手架不能直接当作同一综合分比较。
