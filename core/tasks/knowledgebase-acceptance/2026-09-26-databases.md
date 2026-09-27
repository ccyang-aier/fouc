# T02 · 数据库页面及类型化行属性

日期：2026-09-26。模块：`backend/src/knowledge/databases/`（service/properties/errors/index）与 `shared/src/knowledge/contracts/databases.ts`（新增）+ `pages.ts` kind/属性/筛选契约扩展 + barrel。

真实 PostgreSQL（.env.fouc.local，PG 17.11 / en_US.utf8）一次性 disposable 库上运行验收：

```bash
bun test backend/src/knowledge/databases        # 18 tests / 0 fail / 161 assertions,连跑 4 次一致
bun test backend/src/knowledge/pages            # 23 tests / 0 fail(T01 回归,契约扩展后仍绿)
bun test shared/src/knowledge/contracts         # 9 tests / 0 fail
pnpm shared:typecheck                           # 0 错误
pnpm exec eslint --no-ignore backend/src/knowledge/databases shared/src/knowledge/contracts
                                                # 0 错误;仅存量已提交文件 contracts.test.ts 一条 `_after` 未用警告(非本任务改动)
bun backend/scripts/database-schema.ts --check # Knowledge current SQL matches the Drizzle source.
git diff backend/src/database/knowledge/        # 空——schema 无改动需求
```

`pnpm backend:typecheck` 中 databases 目录 0 错误；全局输出在验收期间持续出现其他并行代理进行中文件(collaboration/search)的瞬时错误,与本任务无关且不属本任务修复范围。

## 通过的实际流程(逐条对应验收标准)

- **数据库与行均为页面**:createAuthorizedDatabase 经 T01 `createAuthorizedPage` 落 kind=database 页面并与 `database_definition.properties`(列 schema)同事务创建;行经同一 T01 路径落 kind=row 页面,parentId/databaseId 指向所属数据库,path 为 `<db>.<row>` ltree,position 为 base-36 分数键。行是独立页面,因此天然携带独立 ACL(inheritsPermissions/显式授权)与 Y.Doc 生命周期(doc_state 按 (workspace,page) 外键级联,行页面与其他 kind 无差异)。测试断言了存储行 kind/parent/database_id/path/position 与 definition 表内容。
- **行级差异化授权经 P03**:测试在四行上构造 继承 / 仅编辑者 view / 编辑者 edit+观察者 view / 无授权 四种形态,经真实 `setAuthorizedPageInheritance`+`replaceAuthorizedPageAcl`+`rebuildPermissionSubtree` 物化后,`authorizePageAccess` 逐主体断言 allow/deny(view 与 edit 分级正确,跨租户拒绝);列表按展开主体过滤:观察者见 2 行、编辑者见 3 行、所有者仅见继承行、beta 主体 0 行;回收行后物化滞后 fail closed 立即不可见。
- **类型化列与行属性验证**:九种列类型(text/number/checkbox/date 含 ISO datetime/select/multiSelect/url/person/relation)全部接受;未知属性、各类型错值、select/multiSelect 未知选项、person/relation 非 UUID、数组重复元素、url 非法格式均 `INVALID_ROW_PROPERTIES` 拒绝;数字数组等不可表示值形态在契约层 `INVALID_DATABASE_INPUT` 拒绝;null 是所有类型的空值。relation 列目标库必须存在(`INVALID_DATABASE_COLUMNS`),relation 值必须解析到目标库现存行页面;属性行级更新整体替换、拒绝时库存不变。
- **筛选/排序/分页与无权行不可见**:eq/neq/gt/gte/lt/lte/contains/isEmpty/isNotEmpty 编译为 jsonb 谓词(eq 数组列为 `@>` 归属、contains 文本列为 ILIKE 子串、通配符字面化);多列排序 jsonb 类型序(null 最小,升序最前/降序最后)+position/id 兜底全序;游标为行页面 ID,seek 谓词与 ORDER BY 同构,7 行 limit 3 与筛选后 limit 1 全程翻页无重无漏;未知列筛选/排序、类型不符筛选值、非法游标、库不存在均在查询前拒绝;可见性谓词(`effectivePageAccessCondition`)与 revision 匹配保证无权行(含物化滞后、已回收)不可见,跨租户 0 泄漏。
- **幂等与并发**:同 id 重放数据库返回已存储列定义、同 id 重放行返回首写落位(库内始终一行);同 id 并发创建两连接收敛一行;不同行并发落位键互异;与非行/他库 id 冲突、目标库缺失/回收统一拒绝。
- **列变更语义(见下节)**:加列即时生效存量行视为空值;删列同事务丢弃全行(含已回收行)该键;改类型拒绝;同类型改名/选项调整接受。

## 实现要点与修复(收尾代理)

- **contains 转义修复(实现缺陷)**:原实现用 pg 内建 `like_escape(value, '\')` 试图字面化 `%`/`_`,实测该函数仅把自定义转义符转换为反斜杠、不转义通配符(`select like_escape('%_x','\')` 原样返回),导致 `contains '%_x'` 误匹配 `task x`。改为 JS 侧 `replaceAll(/[\\%_]/g, '\\$&')` 后作绑定参数,并补 `::text` 显式类型(concat 为 variadic any,裸参数报 42P18)。
- **排序方向修复(类型错误)**:drizzle 0.45 的 `SQL` 对象无 `.asc()/.desc()` 方法,改用 `asc()/desc()` 工厂函数包裹 `coalesce(...,'null'::jsonb)` 单元格片段。
- **listDatabaseRows 的 loadDatabase 参数形状修复**:`{workspaceId, pageId: databaseId}`(契约字段是 databaseId,内部统一按页面 scope 寻址)。
- **null 筛选值显式拒绝**:契约 value 允许 null(属性值宇宙),但非数组列的 eq/neq/范围/contains 不接受 null 比较值(空值判断由 isEmpty/isNotEmpty 承担),类型收窄处显式抛 `INVALID_DATABASE_QUERY`。
- **测试侧修正三处(均以 P03/数据库实测语义为准绳)**:①workspace 主体单独作为 viewer 时只见继承行——P03 在断继承节点 `grants.clear()`,workspace 主体仅携带 teamspace 默认访问(与同测试 owner 对 editorOnlyViews 的 deny 断言自洽);②可见性列表断言改为集合比较(默认列表按 position/id 排序,原 `.sort()` 只排期望侧造成随机 UUID 下的偶发假失败);③`due isNotEmpty` 期望补 `task epsilon`(其 due=2026-03-30 非空,原期望遗漏);多列排序期望修正为 'doing' < 'done'(jsonb 字符串序遵循数据库 collation,`i` < `n`)。
- 列变更与行属性写入在数据库页面行锁(`lockPermissionPage` on database page)上互斥,存储的行属性始终符合当前 schema;行变更/outbox 事件(database.rows.changed / page.updated)与业务写入同事务。

## 列变更语义(明确定义)

- **整体替换按列 id 对齐**:`updateDatabaseDatabaseColumns` 接收完整列数组,新 id=加列,缺失 id=删列,同 id=修改。
- **加列**:即时生效,存量行(含已回收行)不写键、按空值处理(排序/筛选中为 'null')。
- **删列**:同一事务 `properties - removed::text[]` 从所有行(含已回收行)属性中丢弃该键;删列后按该键筛选/排序、向该键写入均被拒绝。
- **改类型**:显式拒绝(`INVALID_DATABASE_COLUMNS`),不做任何隐式转换。
- **同类型改名/选项调整**:接受,存量行中已失效的选项值保留原样(读取不过滤),在下一次写入该行属性时被验证拒绝。
- **无变化提交**(逐元素 JSON 相等)短路返回,不写库不发事件;列顺序不同视为变更(顺序即声明的展示序)。

## 明确边界

- P03 的 HTTP 路由层授权(在数据库页面上校验 full/edit、行页面上校验 edit 的调用方契约已在服务注释声明)与 A02 tRPC 暴露不在本任务;`FoucDatabaseError` 到 HTTP 状态码的映射归路由层。
- 游标锚点行按 (workspace,database,id) 查找,不校验 viewer 对锚点行的可见性:锚点属性仅用于服务端 seek 谓词、绝不返回,但持有数据库 view 的主体可用非法游标探测某 id 是否属于该库(错误码区分),视为可接受的低风险存在性预言。
- relation 值校验为创建/更新时点的存在性断言,不维护引用完整性(目标行此后被回收不回溯清除,读取时表现为指向已回收页面的悬垂引用)。
- jsonb 排序/比较语义:`text/url/date` 值按数据库 collation 的字符串序、number 按数值序、跨类型按 jsonb 类型序;mixed-type 列值间的全序由 DB 决定,应用层不再加一层规范化。
- 后台 graphile-worker 与测试内显式 rebuild 并发消费 acl.changed 属预期(当前态重算收敛),验收未针对 worker 时序做确定性断言。
