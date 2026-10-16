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
| `capabilities` | 视觉输入、工具调用、推理、原生图像／视频生成；明确支持/不支持/未知 |
| `reasoning` | 官方核实的离散思考档位及默认值；不支持或只有 token 预算控制则为 null。档位去重、默认值必须在列表中且推理能力必须为 true |
| `pricing` | USD 每百万 token 的标准输入、输出、缓存读取及写入价；双语备注保留长上下文、时段、缓存期限、图片和工具等计费条件 |
| `ratings` | 智能、Agentic、写作、设计、速度、价格六个固定维度；支持维度必须具有 0–100 分、kind（measured／mock）、双语原值／测量配置／换算方法／观测日期；measured 必须有来源，mock 的 source 必须为空且双语备注明确 Mock；null 仅表示不支持 |
| `sources`、`verified_at` | 官方资料链接及人工核实日期 |

结构化嵌套字段用 typed JSONB，型号、厂商、名称、token 上限和日期使用普通列。当前只消费完整小目录，不提前拆出没有独立维护需求的厂商、价格历史或测评版本表。Drizzle 是唯一当前 schema 来源，生成 `current.sql`，不保留迁移链或旧开发数据兼容路径。

## 资料维护

首版收录 7 个已核实型号：Claude Haiku 4.5、Haiku 5.5、Sonnet 5.5、GPT-6.1 Sol、GPT-6 Luna、DeepSeek V4.1 Flash 和 Nano Banana 2。种子资料位于服务端 `modules/models/catalog-data.json`，核实日期为 2026-10-16。来源包括 [Anthropic 模型文档](https://platform.claude.com/docs/en/models/overview)、[OpenAI 模型文档](https://developers.openai.com/api/docs/models/gpt-6.1-sol)、[DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)及 [Google 模型 API 文档](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image)，各行另外保存直接支持其规格、价格和测评的页面。

不使用前端硬编码目录，普通 API 请求不抓取外站，也不把网页文本当作运行指令。规格和档位先核实官方文档；评分由管理员脚本提取公开机器数据并保留来源，再执行显式管理员导入。完整载荷必须通过共享 schema 和型号唯一性检查后才获取连接；替换在单个事务中完成，失败保留原目录。数据变更由 Git 与核实日期追溯。

运行命令使用 `bun --env-file=.env.fouc.local backend/server/scripts/models-catalog.ts init` 或 `import [catalog.json]`。`init` 只创建不存在的目录 schema 并写入种子，可用于已有独立业务库，不修改其他 schema；已有目录用 `import` 更新资料。空库的统一初始化同时建立目录。生产服务启动和普通 API 读取不创建表或写种子。

## 六维评分与来源

评分是有固定换算规则的能力画像，不是某个机构发布的统一六维总榜，也不等同于准确率。每轴独立保留测量配置和原始值，不跨代借用成绩；不把编程分数当作 Agentic。支持维度没有可核实成绩时按用户要求在目录与数据库中显式保存 mock 分数，不伪装为实测。当前智能、写作、设计、速度、价格五轴必填；Agentic 在 tools 明确为 false 时必须为 null，其余情况必填。2026-10-17 已实际从 [Artificial Analysis](https://artificialanalysis.ai/leaderboards/models)、[Arena 创意写作榜](https://arena.ai/leaderboard/chat/text/creative-writing)和 [DesignArena 前端设计榜](https://www.designarena.ai/leaderboard)取得目录中有对应型号的数据。Arena 本机请求返回 403，目前五个模型的写作快照来自可读取的 2026-10-15 公开榜单；本次重新匹配 DesignArena 后已找到 DeepSeek V4.1 Flash 设计 Elo 1322，换算为 66.9 分。Nano Banana 2 从 AA 图像模型页面取得设计、速度和价格的真实数据，不能拿图像 Elo 冒充文本智能。继续检查 Arena 与 EQBench 后仍未找到 Haiku 5.5 对应写作成绩。当前显式 mock 只有 Haiku 5.5 写作 76、Nano 智能 52／写作 47；它们均为界面开发种子分数。唯一空项为 Nano Agentic，依据其不支持工具调用。

| 维度 | 数据与固定转换 |
| --- | --- |
| 智能 | AA Intelligence Index 原始 0–100 指数；排除来源明确标为估算的值 |
| Agentic | AA-AnalystAgent 任务成功率 ×100；只代表代理数据分析任务集，不能当作通用 Agent 总分 |
| 写作 | Arena Creative Writing 对应配置的偏好 Elo |
| 设计 | 文本模型采用 DesignArena Overall Frontend；生图模型采用 AA 图像质量偏好 Elo，备注保留各自任务口径 |
| 速度 | AA 中位输出速度 v，评分 `100v/(v+100)`；单位 tokens/s，不包含首字等待 |
| 价格 | 标准文本输入／输出 3:1 混合成本 c（USD/百万 tokens），评分 `100/(1+c)`，越便宜越高；不含缓存、折扣和工具费，生图／视频模型不使用该文本公式 |

Nano Banana 2 的真实图像数据来自 [AA 图像模型页面](https://artificialanalysis.ai/image/models/nano-banana-2)，Google Benchmark 代表配置：Elo 1138.52 → 设计 41.2；中位 8.5014 秒／图按 `100×10/(10+秒数)` → 速度 54；0.067 USD／图按 `100/(1+每图价/0.05)` → 价格 42.7。10 秒／图与 0.05 USD／图分别是 50 分参考；不能与文本任务当作同一计量单位比较。

写作与设计 Elo 各自换算为对固定 1200 Elo 参考的偏好胜率：`100/(1+10^((1200−Elo)/400))`。这两个榜单的任务与投票人群不同，转换后仍不能跨轴解释为统一准确率。所有分数最多保留一位小数。DeepSeek API 仅公布“1M”时不擅自推定精确上下文 token 数；价格不换算为平台积分。

执行 `bun backend/server/scripts/models-ratings-sync.ts` 更新种子快照。脚本只解析公开响应中的 JSON／HTML 数据，不执行网页脚本；按显式型号和测量配置映射，源站不可用时警告并保留该来源原快照及观测日期，全部来源失败则不写文件。新实测可以覆盖 mock，源站缺少某型号或返回空观测不能抹除已有有效评分，mock 也不能覆盖实测；Nano 图像页面纳入同一同步入口。可通过管理员环境 `ARTIFICIAL_ANALYSIS_API_KEY` 使用 [AA 正式 API](https://artificialanalysis.ai/api-reference) 的 `/api/v2/data/llms/models`；该 API 要求 `x-api-key`、来源署名及服务端缓存，当前未配置密钥，使用公开页面的结构化数据。正式 API 提供智能和速度，Agentic 仍来自公开页面的 AnalystAgent 测量。同步不直接写库；检查生成载荷后再运行目录 import。公开前端不接触密钥或管理员凭据。

思考档位按型号文档维护：GPT-6.1 Sol 为 low／medium／high／xhigh／max；GPT-6 Luna 另支持 none；Haiku 5.5、Sonnet 5.5 支持 low 至 max；DeepSeek 为 none／low／high／max；Nano Banana 2 为 minimal／high。Haiku 4.5 使用 token 预算控制，当前不伪造离散 effort 档位。具体默认值由目录记录。
