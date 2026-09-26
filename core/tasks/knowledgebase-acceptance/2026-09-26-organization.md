# O01 · 工作区、成员、群组与邀请验收

日期：2026-09-26。结论：O01 已实现并经主代理独立复核；O03 Teamspace 与客户端组织界面不在本项完成范围。

## 实现与安全边界

- 个人/团队工作区共用服务；真实邮箱绑定邀请接受时原子转为 team。owner/admin/member/guest 的成员与目录权限、群组维护、本人退出均有明确边界。
- 一次性邀请使用 256 位随机令牌，数据库仅存 SHA-256，七天过期、重发撤销旧令牌；接受需匹配当前已验证邮箱，并重验邀请人仍有授权。已有成员不能借邀请提权。
- 变更以工作区行锁串行化，角色在锁后重读；最后 owner 不得降级/删除，双连接并发仍保留一个 owner。成员移除级联群组关系并立即失去租户访问权限。
- 请求操作者只来自真实 Better Auth 会话。事务重新验证会话与邮箱，`clock_timestamp()` 检查实际有效期；等待工作区锁后再次检查，防止会话或邀请在等待期间过期却获准写入。
- 只读身份发现仅扩展 workspace/member SELECT，依赖真实未撤销、未过期、已验证的 session。其他业务表无身份跨租户读取通路；每次事务显式清空另一作用域，避免池复用污染。
- Hono HTTP 输入严格校验，写入要求 JSON 与可信 Origin；拒绝 PAT，返回无缓存、无引用来源的脱敏错误。没有新建第二个主服务。

## 主代理验证

```powershell
bun test backend/src/database/knowledge backend/src/knowledge/auth backend/src/knowledge/organization shared/src/knowledge/contracts/organization.test.ts
pnpm backend:typecheck
pnpm shared:typecheck
bun backend/scripts/knowledge-schema.ts --check
pnpm exec eslint --no-ignore backend/src/knowledge/organization backend/src/database/knowledge shared/src/knowledge/contracts/organization.ts shared/src/knowledge/contracts/organization.test.ts
```

- **116 测试、2747 断言，0 失败**；包含 O01 21 项真实 PostgreSQL/HTTP 组织流程与 9 项只读身份发现 RLS 测试，以及数据库与认证回归。
- 真实 Node HTTP socket、Better Auth 注册/验证/cookie、普通非 owner/NOBYPASSRLS 应用角色；不是伪造用户上下文替代集成验收。
- 双连接邀请一次性竞争、并发 owner 删除、等待锁期间角色变更、会话/邀请自然过期均实际验证；失败后没有成员或邀请状态的部分写入。
- 测试仅在创建闭包持有的 UUID 命名临时数据库运行。本轮 `fouc_rls_72fea1f9e8d54cb69625084be53a353b` 已删除并核实不存在；未对主库写入测试成员或身份。
- backend/shared 类型检查、定向 ESLint、Drizzle 当前 SQL 逐字漂移检查通过。

## 明确未覆盖

邀请提供可复制令牌，没有声称外网邀请邮件送达；测试邮箱 transport 仅捕获测试验证邮件。客户端应将令牌置于链接 fragment 并通过 POST 消费，不能放查询字符串或日志。Teamspace 为 O03，页面 ACL 为 P02/P03，组织 UI 为 O02，运行主进程接线为 Z03。

当前唯一 schema 为 29 表/25 张租户表，新增邀请表及两个只读发现 policy。主开发库仍保留此前初始化结构；后续仅在核实精确知识库 schema 内没有业务数据后重建，不引入迁移或兼容分支。Web dev/HMR 保持运行，未构建 Tauri。
