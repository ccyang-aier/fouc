# Knowledge identity authentication

A01 提供 Better Auth 的邮箱身份与数据库会话，不创建 Workspace、Member，也不把身份认证等同于租户授权。只使用 `knowledge_auth` 的四张既有表；不运行 Better Auth CLI/migration，不复制一套 schema。

## 运行时接线

导出位于 `index.ts`，由 Z03 装配独立知识库 API，不能让旧 sidecar 的 Bearer-token 全局中间件拦截邮箱登录路由。

```ts
const config = readKnowledgeAuthConfig(environment);
const email = createSmtpAuthEmailTransport(environment); // 缺配置立即报错
await email.verify(); // 启动前验证 SMTP 连接，不代表外网邮件最终送达
const auth = createKnowledgeAuth({ pool: applicationPool, config, email });
app.route('/', createKnowledgeAuthRoutes(auth, getVerifiedPeerAddress));
```

`getVerifiedPeerAddress(context)` 必须由 HTTP runtime 从 socket 或已验证反向代理提供。模块始终覆盖传入的 `x-fouc-auth-client-ip`，不会采信客户端自己提交的限流地址。直接 Node HTTP 使用 socket.remoteAddress；反向代理环境只接受来自受信任代理且被代理覆盖的真实地址。无合法地址返回 503，不静默关闭限流。复用普通应用 `pg.Pool`，不得传入管理连接；池和 SMTP 的关闭由 runtime 生命周期持有。

业务 HTTP 路由可使用 `requireKnowledgeIdentity(auth)`；它会验证真实数据库会话、已验证邮箱，以及变更请求的可信 Origin，并把仅包含 userId/sessionId/email/name 的身份放入 Hono context。随后仍须验证目标工作区成员资格，再调用 D02 的租户事务。纯服务函数 `getKnowledgeIdentity` 只负责身份查询；它和该中间件均为 Cookie-only，任何 Authorization 头存在时都拒绝，不忽略该头回退 Cookie；支持 PAT 的业务入口使用下文统一 authenticator。WebSocket 等调用者另行验证握手 Origin。API 不因客户端提供 workspaceId 而授予成员权限。

## 环境与 Cookie

- `BETTER_AUTH_URL`：固定的对外 API origin，不含路径。路由固定为 `/api/auth/*`；不从未经验证的 Host/X-Forwarded-Host 推断回调地址。
- `BETTER_AUTH_SECRET`：至少 32 字符的随机秘密，由部署注入且跨重启保持稳定。
- `KNOWLEDGE_AUTH_TRUSTED_ORIGINS`：逗号分隔、逐项精确 origin；未设置时采用 `KNOWLEDGE_ALLOWED_ORIGINS`，再回退到 API origin。禁止通配符、`null`、用户信息、路径和查询参数。
- `KNOWLEDGE_AUTH_COOKIE_MODE`：默认 `same-site`；桌面跨站场景显式配置 `cross-site`。生产 API 及生产 Web origin 要求 HTTPS。

| 场景 | 配置与客户端要求 |
| --- | --- |
| Web 部署 | 推荐页面同源反代 `/api/auth`；host-only、HttpOnly、SameSite=Lax、HTTPS Secure，不设置宽泛 Domain |
| 本地 Web dev | API 与页面统一使用 localhost 或统一使用 127.0.0.1；不同端口可凭精确 CORS + `credentials: 'include'` 使用同站 Cookie；不要混用两个主机名 |
| Tauri WebView → HTTPS API | cross-site 模式，SameSite=None + Secure + HttpOnly；仅按目标平台加入 `tauri://localhost`、`http://tauri.localhost` 或 `https://tauri.localhost`；客户端使用 credentials include |

HTTP loopback API + Tauri 跨站 Cookie 不会被配置成不安全的“可用模式”。WebView/系统的第三方 Cookie 限制也不因 SameSite=None 消失；特别是 macOS/WKWebView，应由 Z03 接入同源代理或受保护的 native Cookie jar，并在实际 WebView 验收。A01 实测了真实 HTTP 代理后端上的三种桌面 Origin、CORS 和 Secure Cookie 往返，未声称已经测试 Tauri 窗口或浏览器第三方 Cookie 策略。不得把会话令牌写进 localStorage 作为绕过措施。

所有认证 POST 必须为 JSON 且携带可信 Origin；CORS 不使用 `*`。Better Auth 的 Origin/CSRF/Fetch Metadata 检查始终启用（包括测试环境）。验证邮件中的 GET 链接允许无 Origin，但 token 和回调目标由 Better Auth 校验。认证响应 `no-store`、`no-referrer`，请求体上限 16 KiB。

## 邮件与错误语义

SMTP 环境：`SMTP_HOST`、`SMTP_PORT`、`SMTP_FROM` 必填；`SMTP_USERNAME`/`SMTP_PASSWORD` 成对配置；`SMTP_SECURE` 可显式设 true/false，默认端口 465 使用 TLS，其余要求 STARTTLS。证书校验和最低 TLS 1.2 不可关闭。不会回退到打印邮件或验证 URL；原始 SMTP 错误不进入日志或响应。

Better Auth 1.7.6 的注册防枚举语义会统一接受注册请求；其 `runInBackgroundOrAwait` 会捕获注册邮件回调异常。此时保留未验证账号，仍然不能登录，诊断回调只接收 `email_delivery_failed` 等固定代码。注册页面文案必须为：**“注册请求已受理，请查收验证邮件；未收到可重发”**，不能承诺已送达。

`POST /api/auth/send-verification-email` 的发送失败返回脱敏 `503`、`code: EMAIL_DELIVERY_FAILED`、`retryable: true`。恢复邮件通道后可以重发并完成验证，不删除账号、不增加补偿系统。其他未知服务错误统一脱敏为可重试的 503。

测试使用 Nodemailer JSON 捕获 transport；验证链接仅在测试进程内读取。没有配置真实 SMTP，也没有向外网邮箱投递或声称送达。

## 密码与会话

- 使用 Better Auth 自带随机盐 scrypt，12～128 字符密码，UUID 使用 `randomUUID()` 回调；不依赖数据库 UUID 默认值。
- 邮箱验证后需显式登录，验证链接本身不创建会话。链接有效期 1 小时。
- 会话存 PostgreSQL：7 天过期、1 天更新窗口、15 分钟敏感操作新鲜期。关闭 Cookie 会话缓存，删除或过期的会话立即拒绝。
- Better Auth 原生 `/list-sessions`、`/revoke-session`、`/revoke-other-sessions`、`/revoke-sessions` 和 `/sign-out`。跨用户 revoke 返回统一成功但不会删除对方会话，避免泄露 token 存在性。
- 内建内存限流始终启用：登录每 IP 20 次/分钟、注册 10 次/分钟、重发 5 次/分钟；地址由可信 HTTP transport 注入。此限流为单进程范围，Z03 多副本部署须接共享存储/网关限流，不能把它声称为分布式额度。

`createKnowledgeAuth` 可选服务端 `rateLimitStorage` 使用 Better Auth 官方原子 customStorage；生产省略时仍使用内建 memory。测试 server 每实例注入独立 Map，避免官方模块全局内存桶跨测试串扰；没有关闭限流或伪造来源地址，原有 429 / 真实 socket IP 回归保持通过。

## PAT 与服务端请求上下文（A03）

```ts
const dependencies = { pool: applicationPool, auth };
const tokens = createKnowledgeTokenService(dependencies);
const requests = createKnowledgeRequestAuthenticator(dependencies);

// 仅 verified Session + 当前工作区成员可管理自己的令牌。
const created = await tokens.create(request, {
  workspaceId, name: 'Research CLI', scopes: ['read'],
  expiresAt: '2027-01-01T00:00:00Z', // 必须晚于数据库当前时间；显式 null 表示不设到期。
});
// created.token 只在本次创建结果出现；后续 list 仅返回 metadata，不返回 hash。
await tokens.revoke(request, { workspaceId, tokenId });
const metadata = await tokens.list(request, workspaceId);

const context = await requests.authenticate(request, workspaceId, ['read']);
// API 可复用 requireKnowledgeRequest(requests, c => c.req.param('workspaceId'), ['read'])。
// WS/长任务后续每次操作刷新，不能把握手时的权限快照无限复用。
const current = await requests.refresh(context, ['write']);
requireKnowledgeScopes(current, ['write']);
// 下一步仍需 P03 对 current.userId 执行页面 ACL，之后才能访问业务数据。
```

令牌格式为 `fouc_pat.<workspace UUID>.<token UUID>.<secret>`；secret 是 `node:crypto.randomBytes(32)` 产生的 256-bit 随机量，以无 padding 的规范 base64url 表示。UUID 仅为公开定位字段；替换 workspace/id 不会认证成功。数据库只保存整串令牌的 SHA-256，不保存可恢复明文。验证始终比较两个 32-byte 摘要（包括未找到记录时的 dummy 值），使用 [`timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)。这不声称整个 HTTP/数据库路径耗时恒定；格式或租户不匹配也会提前拒绝。

本模块只接受 `Authorization: Bearer <PAT>`，不读取 query、body、Cookie 中的 PAT。任意 Authorization 头一旦存在，无论空值、错误 scheme、逗号合并的重复值、格式错误或失效令牌，都不回退 Cookie；有效 PAT 与 Cookie 同时存在时只采用 PAT 身份。机器 Bearer 请求可无 Origin；有 Origin 时仍须命中精确允许列表。Cookie 请求沿用 A01 Origin/CSRF 边界。生产 Bearer 必须经 HTTPS，代理/访问日志须移除 Authorization 和 Cookie，并禁止记录 PAT 创建响应正文；令牌管理路由必须设置 `Cache-Control: no-store` / `Referrer-Policy: no-referrer`、限制 JSON 请求体大小。Z03 装配这些路由，本模块不启动 HTTP 服务或修改旧 sidecar 认证。

Scope 仅允许显式 `read`、`write`，必须非空、无重复；`write` **不隐含 read**，也不授予管理、邀请或 ACL 权限。读工具要求 read，写工具要求 write；同时读写的操作应显式要求两项。Session 上下文拥有两项操作 scope，但仍受成员角色与页面 ACL 限制。guest 可为自己创建 write PAT，不意味着它能写任何无权限页面。管理接口只认 verified Session，PAT 即使有两项 scope 也不能创建/列出/撤销令牌，不能借此升级权限。任何成员（包括 owner）仅管理自己的 PAT；撤销不存在/他人的 ID 返回相同幂等结果，不暴露存在性。

所有解析后的 bearer 查询都局限在其编码工作区，且必须等于目标工作区。这里使用 D02 tenant transaction 完成**窄范围认证 bootstrap**：只取该 workspace/id 的凭证，秘密摘要通过后再检查真实 user/member；定位 UUID 不能授权任何业务查询，也不允许 PAT 进入跨工作区 discovery。创建、列出和撤销在事务内重新核验数据库 session.id/userId、到期、emailVerified 与 membership；创建/撤销时的共享锁保护这些检查至事务结束。验证 PAT 每次检查 hash、scopes、到期、撤销、已验证用户及当前成员资格，无凭证缓存；lastUsedAt 记录成功身份核验，即使后续 scope/ACL 拒绝也可能更新。

`KnowledgeRequestContext` 为不可变、仅服务端签发的对象，包含 workspaceId、userId、实时成员角色、credential（sessionId 或 tokenId）、scopes 和 `{kind:'human',userId}` 发起者。请求 body/header 中的 userId、kind、taskId、clientName 不能覆盖它；PAT 是一种凭证，不自动意味着 MCP 身份。后续 Agent/MCP 适配器必须从可信任务记录建立 actor 来源，不得直接采用客户端声明。`requireKnowledgeScopes` 拒绝 JSON 重建/复制对象，仅验证 scope 上限；它不查询数据库，也不能作为持久授权。`refresh` 只接受同一 authenticator 实例签发的上下文，私有 WeakMap 仅保存会话定位或 PAT 摘要证明，不保存 Bearer 明文；每次重新查验凭证、成员、用户、scope 并返回新上下文。旧 snapshot 不会悄悄变更，也不能跨进程序列化为权限凭据。已经在执行中的操作不会被自动中断，后续操作必须重新 authenticate/refresh；页面 ACL 与事务时权限检查仍由业务层负责。

错误与诊断只输出固定 code/message，不保留数据库原始错误、参数、令牌或 request header 为 error cause。HTTP 消费方使用 `knowledgeAccessErrorResponse`，不要直接输出未捕获错误。MCP OAuth 2.1 和 MCP 协议错误映射在后续任务实现，PAT 不是 OAuth access token 的兼容替代实现。没有新增 schema、migration 或旧格式适配。

真实 PostgreSQL/Node HTTP 测试覆盖相同 token UUID 在不同租户的隔离、改写 locator、一次性明文、显式 scopes、期限/撤销/成员退出/邮箱失效/用户删除、Bearer 不回退 Cookie、跨用户管理、伪造 actor、长连接刷新与数据库错误脱敏。测试数据库由 D03 disposable helper 创建并清理，主数据库不写入测试数据。PostgreSQL skill 的最小权限与复合索引规则使所有认证 SQL 复用普通应用连接和既有 `(workspace_id,id)` 主键；无跨租户扫描或新索引。

## 验证

```powershell
bun test backend/src/knowledge/auth
pnpm exec tsc --noEmit -p backend/tsconfig.json
pnpm exec eslint --no-ignore backend/src/knowledge/auth
```

测试通过 Node `http` 的真实随机端口和普通 PostgreSQL 角色执行，使用 D03 的唯一命名临时数据库创建/清理机制，不向开发主库 seed。包含密码哈希、验证 token 失效/伪造、Cookie/CORS/CSRF、成员隔离、会话撤销、邮件重试和地址伪造限流验证。

版本依据与参考：官方 [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)、[邮箱密码](https://better-auth.com/docs/authentication/email-password)、[会话管理](https://better-auth.com/docs/concepts/session-management)、[Hono](https://better-auth.com/docs/integrations/hono)、[Cookie 限制](https://better-auth.com/docs/concepts/cookies)、[SMTP TLS](https://nodemailer.com/smtp)。PostgreSQL skill 的连接复用与最小权限规则用于持久化边界；租户 RLS 不作用于全局身份表，也不被认证模块绕过。
