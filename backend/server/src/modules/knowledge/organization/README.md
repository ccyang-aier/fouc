# Knowledge organization service (O01 / O03)

`createOrganizationService(pool)` 使用普通应用角色，所有入口接收由服务端认证生成的 `FoucIdentity`。每次事务重新核对 sessionId/userId、过期时间及已验证邮箱，并读取当前成员角色；身份不是成员资格，HTTP body 中也没有操作者字段。

`createOrganizationRoutes(auth, service)` 导出真实 Hono HTTP 集成，挂载在 `/`，路由限于 `/api/knowledge/workspaces`，须放在旧 bearer catch-all 之前。Z03 负责接入运行进程，本模块不启动第二个服务，也不停止 Web dev。写操作要求 JSON 与可信 Origin；只接受 Better Auth 会话，不接受 PAT。CORS/HttpOnly cookie 配置复用 A01，路由统一 `no-store`、`no-referrer`，内部异常只返回脱敏的可重试 503。

## 角色边界

| 操作 | owner | admin | member | guest |
|---|---|---|---|---|
| 查看所属工作区、退出自身成员资格 | 是 | 是 | 是 | 是 |
| 查看成员及群组目录 | 是 | 是 | 是 | 否 |
| 重命名工作区、管理群组 | 是 | 是 | 否 | 否 |
| 邀请、移除、变更其他成员角色 | 所有角色 | 仅 member / guest | 否 | 否 |
| 邀请 admin | 是 | 否 | 否 | 否 |
| 提升已有成员为 owner | 是 | 否 | 否 | 否 |

邀请不能直接创建 owner。最后一位 owner 不能被降级或移除，包括自退。修改成员、邀请和群组时统一先持有有效会话/用户共享锁、再锁工作区行，随后重验会话并重读角色。会话和邀请使用数据库 `clock_timestamp()` 判断有效期，避免锁等待跨过期时间后仍依据事务开始时间放行。group_member 的复合租户外键保证只能关联当前工作区的已有成员；删除成员/群组会级联清除群组成员关系，不删除身份与历史作者记录。

个人与团队使用相同服务路径。个人工作区在邀请成功接受的同一事务内转为 team，失败回滚；成员减少后不自动退回 personal。

## 邀请与发现

创建邀请返回 `{ invitation, token }`，令牌仅此时可见：32 个随机字节、base64url 编码，数据库只保存 SHA-256 哈希，7 天到期。重新邀请同一邮箱会撤销旧令牌。接受必须由邮箱完全匹配（不区分大小写）的已验证用户发起；邮件地址来自数据库，不信任缓存身份字段。只接受一次；已有成员不能用邀请提升角色。接受时还复核邀请人的当前授权，失去管理权限后旧邀请不能继续授予其之前的权限。

O01 提供可复制的一次性邀请令牌，不自动发外网邀请邮件。消费 UI 应将 token 放在邀请链接 fragment 中，读取后用 POST body 接受，并移除 fragment，避免服务访问日志与 Referer 泄露；不要把令牌写进日志或查询字符串。A01 邮箱验证 transport 仍独立负责身份邮箱验证。

工作区列表通过事务局部 `app.auth_session_id` 的只读发现策略查询，仅 `member`、`workspace` 有 SELECT 扩展；其他业务表仍为空。策略依赖真实 session 有效期与邮箱验证，撤销即失效，无全局管理员或 RLS 绕过。成员目录从已授权租户的 member 连接全局身份表，不提供全局邮箱查找。列表按 UUID 游标分页，默认 50，最大 100。

## HTTP 路径

相对于 `/api/knowledge/workspaces`：

| 路径 | 方法 | 内容 |
|---|---|---|
| `/` | GET / POST | 自己的工作区列表 / 创建 |
| `/:workspaceId` | GET / PATCH | 详情 / 重命名 |
| `/:workspaceId/teamspaces` | GET / POST | Teamspace 列表 / 创建 |
| `/:workspaceId/teamspaces/:teamspaceId` | GET / PATCH / DELETE | Teamspace 详情 / 修改 / 删除空空间 |
| `/:workspaceId/members` | GET | 成员目录 |
| `/:workspaceId/members/:userId` | PATCH / DELETE | 角色变更 / 移除或自退 |
| `/:workspaceId/groups` | GET / POST | 群组列表 / 创建 |
| `/:workspaceId/groups/:groupId` | PATCH / DELETE | 重命名 / 删除 |
| `/:workspaceId/groups/:groupId/members` | GET / POST | 群组成员 / 添加 |
| `/:workspaceId/groups/:groupId/members/:userId` | DELETE | 移除群组成员 |
| `/:workspaceId/invitations` | GET / POST | 邀请列表（无 token/hash）/ 创建并返回 token |
| `/:workspaceId/invitations/:invitationId` | DELETE | 撤销 |
| `/:workspaceId/invitations/:invitationId/accept` | POST | 邮箱绑定接受 |

URL 参数不得在 body 中重复；DELETE 发送 `{}`。共享 Zod schema 拒绝多余字段，错误码包含 `FORBIDDEN`、`WORKSPACE_NOT_FOUND`、`LAST_OWNER`、`INVITATION_INVALID`、`CONFLICT`。请求中的 `userId` 只代表被管理对象，不代表操作者。

## Teamspace 与根默认权限（O03）

`teamspaces.ts` 复用同一组织服务、认证中间件和工作区事务。owner/admin 可创建、重命名、变更根默认级别、删除；owner/admin/member 可读元数据，guest 不开放组织目录。读取 Teamspace 名称或默认值不授予任何页面权限。个人/团队完全同路径，不创建第二套个人空间权限逻辑。

创建输入为 `{ name, defaultAccess? }`，省略时安全默认 `null`；PATCH 只接收 `name` 和/或 `defaultAccess`。`view/comment/edit/full/null` 保存在现有 `teamspace.default_access`，更新同步写 `updated_at`。ID 由服务端生成，URL 提供 workspaceId/teamspaceId，未知字段、伪造身份和跨租户范围会拒绝。空列表与 UUID 游标分页沿用 O01。

`readTeamspacePermissionRoot(db, { workspaceId, teamspaceId })` 只从调用方已授权的租户事务中读取 `{ workspaceId, teamspaceId, defaultAccess }`，可直接作为 P01 `computeEffectivePermissions` 输入的一部分。它不是授权接口，不开启跨租户发现，也不缓存默认值；P02 应在自己的同一租户事务中使用该函数，结合完整页面祖先链计算权限。

当前尚无 P02 物化失效围栏，因此安全边界如下：

- 真正空的 Teamspace 可以修改任意默认级别或清为 null。
- 包含任何 page（含回收站页面）时，实际改变 defaultAccess 返回 `409 TEAMSPACE_DEFAULT_ACCESS_REQUIRES_REBUILD`，保持原默认值、名称、ACL 和索引不变；不能将“只更新根值”声称为安全撤权。同值提交及单独重命名不影响权限，可以正常执行。
- 删除仅限真正空空间，否则返回 `409 TEAMSPACE_NOT_EMPTY`。不因表上存在 CASCADE 就隐式删除正文、检查点或回收站内容。
- 变更先按 O01 顺序锁会话/用户和工作区，再对 Teamspace `FOR UPDATE`，与新页面的 FK key-share 锁互斥；取得该锁后再次检查会话有效期，按实时数据库时钟拒绝已过期会话。

P02 接线时必须一次性将非空空间默认值变更的拒绝条件替换成**同事务的根默认值更新、页面 ACL revision 失效围栏和 Outbox 入队**，再异步重算/同步 block_index；不能保留临时双轨开关，也不能在重算完成前让旧授权继续放行。O03 不提前实现该 Worker、权限物化或页面授权逻辑。

## 验证

```powershell
bun test backend/server/src/platform/database/knowledge backend/server/src/platform/identity backend/server/src/modules/knowledge/organization shared/src/knowledge/contracts/organization.test.ts
bun backend/server/scripts/database-schema.ts --check
pnpm backend:typecheck
pnpm shared:typecheck
```

测试创建独立 UUID 命名 PostgreSQL 库，使用普通应用角色及真实 Node HTTP socket、Better Auth 邮箱验证和 cookie 会话；只捕获测试邮件，不声称外网邮件送达。覆盖全部租户隔离、发现只读/会话失效/池复用、角色越权、邀请原子回滚、群组级联及双连接并发 owner 保护。测试库由创建闭包清理并核实不存在，不修改主库。

当前唯一 schema 新增邀请表及两个 SELECT policy。已有开发主库须由主代理明确核验范围后重建空 schema；没有 migration、旧 schema 兼容分支或业务 seed。O01 不提供删除全局身份接口；未来启用账户删除时也须维护最后 owner 不变量。
