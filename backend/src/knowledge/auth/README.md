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

业务 HTTP 路由可使用 `requireKnowledgeIdentity(auth)`；它会验证真实数据库会话、已验证邮箱，以及变更请求的可信 Origin，并把仅包含 userId/sessionId/email/name 的身份放入 Hono context。随后仍须验证目标工作区成员资格，再调用 D02 的租户事务。纯服务函数 `getKnowledgeIdentity` 只负责身份查询；WebSocket 等调用者另行验证握手 Origin。API 不因客户端提供 workspaceId 而授予成员权限。

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

## 验证

```powershell
bun test backend/src/knowledge/auth
pnpm exec tsc --noEmit -p backend/tsconfig.json
pnpm exec eslint --no-ignore backend/src/knowledge/auth
```

测试通过 Node `http` 的真实随机端口和普通 PostgreSQL 角色执行，使用 D03 的唯一命名临时数据库创建/清理机制，不向开发主库 seed。包含密码哈希、验证 token 失效/伪造、Cookie/CORS/CSRF、成员隔离、会话撤销、邮件重试和地址伪造限流验证。

版本依据与参考：官方 [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)、[邮箱密码](https://better-auth.com/docs/authentication/email-password)、[会话管理](https://better-auth.com/docs/concepts/session-management)、[Hono](https://better-auth.com/docs/integrations/hono)、[Cookie 限制](https://better-auth.com/docs/concepts/cookies)、[SMTP TLS](https://nodemailer.com/smtp)。PostgreSQL skill 的连接复用与最小权限规则用于持久化边界；租户 RLS 不作用于全局身份表，也不被认证模块绕过。
