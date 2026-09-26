# Knowledge organization service (O01)

`createOrganizationService(pool)` 使用普通应用角色，所有入口接收由服务端认证生成的 `KnowledgeIdentity`。每次事务重新核对 sessionId/userId、过期时间及已验证邮箱，并读取当前成员角色；身份不是成员资格，HTTP body 中也没有操作者字段。

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

## 验证

```powershell
bun test backend/src/database/knowledge backend/src/knowledge/auth backend/src/knowledge/organization shared/src/knowledge/contracts/organization.test.ts
bun backend/scripts/knowledge-schema.ts --check
pnpm backend:typecheck
pnpm shared:typecheck
```

测试创建独立 UUID 命名 PostgreSQL 库，使用普通应用角色及真实 Node HTTP socket、Better Auth 邮箱验证和 cookie 会话；只捕获测试邮件，不声称外网邮件送达。覆盖全部租户隔离、发现只读/会话失效/池复用、角色越权、邀请原子回滚、群组级联及双连接并发 owner 保护。测试库由创建闭包清理并核实不存在，不修改主库。

当前唯一 schema 新增邀请表及两个 SELECT policy。已有开发主库须由主代理明确核验范围后重建空 schema；没有 migration、旧 schema 兼容分支或业务 seed。O01 不提供删除全局身份接口；未来启用账户删除时也须维护最后 owner 不变量。
