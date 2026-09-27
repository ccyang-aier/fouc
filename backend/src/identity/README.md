# Fouc identity authentication

Fouc 所有模块共用此账户与会话服务。知识库成员、页面 ACL 与 PAT 由 `backend/src/knowledge/access` 和 permissions 服务处理。

A01 提供 Better Auth 的邮箱身份与数据库会话，A02 增加 OAuth/OIDC 企业 SSO；不创建 Workspace、Member，也不把身份认证等同于租户授权。只使用 `auth` 的四张既有表；不运行 Better Auth CLI/migration，不复制一套 schema。

## 运行时接线

导出位于 `index.ts`，由服务运行时装配全局 `/api/auth` API，不能让旧 sidecar 的 Bearer-token 全局中间件拦截邮箱登录路由。

```ts
const config = readFoucAuthConfig(environment);
const email = createSmtpAuthEmailTransport(environment); // 缺配置立即报错
await email.verify(); // 启动前验证 SMTP 连接，不代表外网邮件最终送达
const oauth = readFoucOAuthOptions(environment); // 未配置提供方时为空，不影响邮箱登录
const auth = createFoucAuth({ pool: applicationPool, config, email, oauth });
app.route('/', createFoucAuthRoutes(auth, getVerifiedPeerAddress));
```

`getVerifiedPeerAddress(context)` 必须由 HTTP runtime 从 socket 或已验证反向代理提供。模块始终覆盖传入的 `x-fouc-auth-client-ip`，不会采信客户端自己提交的限流地址。直接 Node HTTP 使用 socket.remoteAddress；反向代理环境只接受来自受信任代理且被代理覆盖的真实地址。无合法地址返回 503，不静默关闭限流。复用普通应用 `pg.Pool`，不得传入管理连接；池和 SMTP 的关闭由 runtime 生命周期持有。

业务 HTTP 路由可使用 `requireFoucIdentity(auth)`；它会验证真实数据库会话、已验证邮箱，以及变更请求的可信 Origin，并把仅包含 userId/sessionId/email/name 的身份放入 Hono context。随后仍须验证目标工作区成员资格，再调用 D02 的租户事务。纯服务函数 `getFoucIdentity` 只负责身份查询；它和该中间件均为 Cookie-only，任何 Authorization 头存在时都拒绝，不忽略该头回退 Cookie；支持 PAT 的业务入口使用下文知识库授权适配器 `../knowledge/access` 的 authenticator。WebSocket 等调用者另行验证握手 Origin。API 不因客户端提供 workspaceId 而授予成员权限。

## 环境与 Cookie

- `BETTER_AUTH_URL`：固定的对外 API origin，不含路径。路由固定为 `/api/auth/*`；不从未经验证的 Host/X-Forwarded-Host 推断回调地址。
- `BETTER_AUTH_SECRET`：至少 32 字符的随机秘密，由部署注入且跨重启保持稳定。
- `FOUC_AUTH_TRUSTED_ORIGINS`：逗号分隔、逐项精确 origin；未设置时仅采用 API origin。禁止通配符、`null`、用户信息、路径和查询参数。
- `FOUC_AUTH_COOKIE_MODE`：默认 `same-site`；桌面跨站场景显式配置 `cross-site`。生产 API 及生产 Web origin 要求 HTTPS。

| 场景 | 配置与客户端要求 |
| --- | --- |
| Web 部署 | 推荐页面同源反代 `/api/auth`；host-only、HttpOnly、SameSite=Lax、HTTPS Secure，不设置宽泛 Domain |
| 本地 Web dev | API 与页面统一使用 localhost 或统一使用 127.0.0.1；不同端口可凭精确 CORS + `credentials: 'include'` 使用同站 Cookie；不要混用两个主机名 |
| Tauri WebView | `src-tauri/src/service_http.rs` 只访问构建时配置的全局 origin；原生网络桥读取/更新 WebView 的持久 HttpOnly Cookie，设备 IPC token 不参与用户认证。正式服务使用 HTTPS。 |

桌面回调仅添加实际平台 origin。原生请求使用固定服务 Origin，不开放自定义 Cookie、Origin 或 Authorization 请求头，不跟随 HTTP 重定向，也不向 JS 返回 Set-Cookie。Web Cookie 安全配置不变。协作连接通过已登录 HTTP 请求取得 20 秒、单次、路径绑定的 socket ticket；握手后继续实时校验全局会话与资源 ACL。

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

`createFoucAuth` 可选服务端 `rateLimitStorage` 使用 Better Auth 官方原子 customStorage；生产省略时仍使用内建 memory。测试 server 每实例注入独立 Map，避免官方模块全局内存桶跨测试串扰；没有关闭限流或伪造来源地址，原有 429 / 真实 socket IP 回归保持通过。

## OAuth、OIDC 与企业 SSO（A02）

使用固定的 Better Auth **1.7.6** `genericOAuth`、`authorizationCodeRequest`、`getOAuth2Tokens`、官方 state/callback、`addOAuthServerContext` / `getOAuthState` 和 `user.validateUserInfo`。JWS/JWKS 使用 **jose 6.2.10**；不实现另一套登录会话、授权服务器或用户表。`oauth-provider.ts` 只为官方提供方装配受限 HTTP 与经过验证的元数据，核心回调和签名/nonce 校验仍由官方执行。

运行时从 `FOUC_AUTH_PROVIDERS` 读取提供方数组 JSON，显式传入 `createFoucAuth({ ..., oauth })`。下面是配置形状，示例占位符不是可用秘密：

```json
[
  {
    "id": "company",
    "kind": "oidc",
    "name": "Company SSO",
    "issuer": "https://identity.example.com/realms/company",
    "clientId": "fouc",
    "clientSecret": "<deployment-secret>",
    "allowedEmailDomains": ["example.com"]
  }
]
```

仅部署管理员能配置提供方，绝不把这个配置接口暴露给浏览器或工作区成员。`id` 是稳定的全局命名空间，不能含路径或使用保留值 `credential`；禁止重复 ID、任意安全开关与未知字段。Secret 必须通过部署秘密注入，不出现在 Git、诊断或公开提供方列表。A02 不修改根 env/compose 或生产 server，Z03 按上述接口装配。

| 项目 | 规则 |
| --- | --- |
| OIDC | 精确 issuer + `${issuer}/.well-known/openid-configuration`；必须支持 code、S256、可信非对称签名算法与 JWKS |
| 普通 OAuth | `kind: "oauth"`，显式 `authorizationUrl` / `tokenUrl` / `userInfoUrl` / `scopes`；userinfo 必须返回不可变 `id`、`email`、布尔 `email_verified`、`name`；不能冒充 OIDC 解码未验证 JWT |
| Token endpoint | 默认 `client_secret_basic`；支持服务端显式 `client_secret_post`；只允许 confidential code + S256，不请求 refresh/offline grant |
| 网络 | 生产全部 HTTPS；无 userinfo/query/fragment；discovery 的所有端点默认与 issuer 同 origin，跨 origin 须显式配置 `endpointOrigins` |
| DNS / SSRF | 默认拒绝私网、保留、metadata、映射 IPv6 和过渡地址；解析全部地址并检查，再将选中的地址固定给 socket，保持原 Host/SNI；不进行第二次 DNS 查询或跟随 HTTP 重定向 |
| 私有部署 | 内部 HTTPS IdP 可由管理员显式 `allowPrivateNetwork: true`；这项授权仅限已配置 origin，不降低 TLS 校验。开发 HTTP 仅精确 loopback，localhost 也只能解析到 loopback |
| 预算 | 每次网络请求含 DNS/响应体默认 8 秒，服务端 `oauth.timeoutMs` 可设 100～15,000 ms；响应最多 128 KiB、响应头 16 KiB，不记录外部错误正文 |
| OIDC claims | 官方 JWKS 校验 signature、issuer、audience、nonce；额外强制 exp/iat/sub/nonce，检查 azp，最长 ID Token 年龄 10 分钟；无 ID Token 的 OIDC 不降级成 userinfo 登录 |

首次使用提供方才做 discovery，成功后该进程复用固定的已验证元数据；JWKS 按 JOSE 缓存/轮换机制读取。发现失败不拖慢邮箱/会话路由，下一次发起登录会重试，不要求重启 API。已配置 issuer 或端点变更属于部署配置变更，需重新装配 auth；不得在运行中借客户端输入改变它。企业域名限制只控制该 IdP 的身份入口，**不是 workspace 成员/页面 ACL 授权**。

### HTTP 登录与关联

- `GET /api/auth/oauth/providers`：仅 `{id,name,kind}[]`，表示已配置入口，**不是 IdP 健康检查**。
- `POST /api/auth/sign-in/social`：`{provider,callbackURL?,errorCallbackURL?,newUserCallbackURL?,disableRedirect?,requestSignUp?,loginHint?}`；JSON + 可信 Origin，返回官方 `{url,redirect}`。客户端使用顶层导航访问授权 URL，不把令牌存 localStorage。
- IdP 必须精确注册 `${BETTER_AUTH_URL}/api/auth/callback/<id>`。服务端固定构造此 `redirect_uri`，不读取未经验证的 Host/X-Forwarded-Host。只接受授权码 `response_mode=query` 的 GET 回调，不支持 `form_post`、无 state IdP-initiated 或前端直接提交 ID Token。
- 应用完成/失败回调必须是精确 trusted origin 下的 HTTP(S) URL 或安全相对路径，拒绝反斜线、协议相对地址、用户信息、任意 scheme。客户端不能增加 scope、issuer、additionalData、额外 authorization params 或伪造 link/userId。
- `POST /api/auth/link-social` 复用同一输入，但要求**当前已验证且 15 分钟内的新鲜会话**。发起者的 provider/user/session ID 经官方 serverContext 存入 state，回调写账户前重新读取活态 session；撤销、过期、用户切换、不同邮箱或已归属另一用户的 subject 均拒绝。`unlink-account` 同样要求新鲜 verified session，原生逻辑保留最后一个登录方式的保护。
- 原生 `list-accounts` 仅返回本人的账户元数据。`get-access-token`、`refresh-token`、`account-info` 对 HTTP 关闭；它们不是本产品的第三方 API 授权接口。

全局 user UUID 是唯一身份。OIDC account 的键是 `(providerId, JSON.stringify([issuer, sub]))`；普通 OAuth 为 `(providerId, JSON.stringify([userInfoUrl, id]))`。邮箱/名称是可变资料，不是 subject；返回用户仍映射原 UUID，不用 IdP 的新邮箱覆盖本地已验证邮箱。不复制 user 到 workspace，也不写任何成员角色。

**禁止按邮箱隐式合并**，即便双方都已验证。同邮箱已有用户先用原登录方式认证，再显式 link；两种方式随后回到同一个 UUID。未验证本地账号不会被外部 verified email 接管。每次外部登录都要求该次 IdP profile 的 `email_verified === true` 且满足服务端域名限制，不能靠以前验证过的本地 email 绕过失效的 IdP claim。

所有 provider access/refresh/ID token 只在当前服务器处理流程内使用；account create/update hooks 将三种 token 及其到期字段置空，`storeAccountCookie` 关闭。既有 PAT 与用户 session 完全不变。没有持久保存 provider grant，因而退出仅撤销 **Fouc** 会话，不声称已经退出 IdP 全局会话；后续再登录可能复用企业 IdP 的浏览器会话。

### 单次 state 与可恢复错误

官方数据库 state 的寿命为 10 分钟，签名 state Cookie 为 5 分钟，Cookie/状态检查不开后门。固定 1.7.6 的 `dist/state.mjs:parseGenericState` 使用 **find → cookie check → delete**，没有可配置的原子消费 hook；在 `getToken` 扩展点被调用时，原始行已经删除。因此这里没有重写 SDK 或伪称顺序删除具有原子性。

`oauth-state.ts` 只在官方 Cookie/state 校验通过后、token exchange 之前增加单次标记：既有 verification 表中的保留 UUID v8 主键，固定 `fouc:oauth:consumed:v1:` 命名空间 + SHA-256(state)，不保存 state 明文。`INSERT ... ON CONFLICT DO NOTHING` 使独立连接/实例仅一次成功；有效 state 错误 Cookie 不会提前消费标记。标记至少保留 15 分钟，并保证晚于原始 state 到期至少 1 分钟，每次新 claim 最多清理 128 条该命名空间的过期标记，不删除其他功能的记录。无新表、migration 或第二套凭证。

用户拒绝是 `access_denied`；IdP 自带的其他错误固定映射为 `oauth_provider_error`，移除外部 `error_description`，避免凭据进入重定向。state、issuer、code、nonce 或会话绑定失败保留稳定错误码；失败流程不可恢复使用旧 code/state，用户重新发起即可。网络/发现/未知服务错误复用 A01 的脱敏 `503 AUTH_UNAVAILABLE`。OAuth 发起每 IP 20 次/分钟、显式 link 10 次/分钟；继续使用真实 socket IP 与共享 `rateLimitStorage` 接口，多副本部署规则同 A01。

Web/Tauri 的 Cookie 边界仍遵循前文。A02 验证真实 HTTP 协议，不声称已完成浏览器系统登录窗口回跳、WebView Cookie 转接或 UI；A04/Z03 完成这些客户端闭环。OIDC 已覆盖企业 SSO；未实现 SAML、SCIM、自助动态 IdP 注册或 OAuth 授权服务器，MCP OAuth 2.1 仍属于 K02。

### A02 验证

`oidc-test-provider.ts` 是仅测试用途的本地标准协议 IdP：Node HTTP、真实 RSA/JWKS、精确注册 redirect URI、客户端认证、S256、一次性授权码与实际签名 ID Token。测试控制的是用户选择/故障，不 mock OAuth SDK 或识别结果；不将它声称为通过 OpenID 认证的产品 IdP。

每项 OAuth 集成测试使用新的 disposable database/普通应用角色/独立限流桶，均由已有 D03 closure 清理；不关闭生产限流或向开发主库写 fixture。并发测试只把官方真实删除的时序对齐，仍执行所有真实 Cookie/DB/HTTP 操作；两个不同有效 code、相同 state 只有一个成功。另用两个独立普通 pool 直接验证唯一标记的竞争与命名空间清理。

```powershell
bun test backend/src/identity
pnpm backend:typecheck
pnpm exec eslint --no-ignore backend/src/identity

# 纯 Node 验证：打包测试入口并复制其 SQL 运行资产（均位于精确 ignored .runtime）。
bun build backend/src/identity/oauth-node-smoke.ts --target=node --format=esm --outfile backend/src/identity/.runtime/oauth-node-smoke.mjs
Copy-Item -LiteralPath backend/src/database/current.sql -Destination backend/src/identity/.runtime/current.sql
node --env-file=.env.fouc.local backend/src/identity/.runtime/oauth-node-smoke.mjs
```

没有读取用户模型密钥；没有访问外网企业 SSO 账号。参考 [官方 Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth)、[账号关联](https://better-auth.com/docs/concepts/users-accounts)、[JOSE](https://github.com/panva/jose)，以实际安装 1.7.6 源码为准。PostgreSQL skill 的最小权限和连接复用要求用于全局账户查询/单次 marker：只用普通应用 pool 和既有唯一约束。

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

## MCP OAuth 2.1 授权服务器（K02）

`oauth-server.ts` 是 MCP 专用 OAuth 2.1 授权服务器引擎：RFC 7591 动态注册（仅公共 PKCE 客户端，`token_endpoint_auth_method=none`）、S256 PKCE、5 分钟一次性授权码（原子 `DELETE ... RETURNING` 认领）、HMAC 绑定的同意表单证明，以及把验证后的授权换成 PAT。HTTP 形态（RFC 9728/8416 元数据、authorize/token/register/revoke 路由与同意页面）在 `knowledge/mcp/oauth.ts`，挂载在 HTTP 根路径：

```ts
app.route('/', createKnowledgeMcpAuthorizationRoutes({ auth, pool, externalOrigin }));
const mcp = createKnowledgeMcpRequestHandler({ authenticator, pool, oauth: { externalOrigin } });
```

- 资源为 `<externalOrigin>/api/knowledge/<ws>/mcp`；未认证的 MCP 请求按 RFC 9727 返回 `401 + WWW-Authenticate: Bearer resource_metadata=...`，元数据位于 RFC 9728/8416 的 path-suffix well-known 路径，AS issuer 为 `<externalOrigin>/api/knowledge/<ws>/oauth`。
- 授权码与注册客户端存于 `auth.verification`（沿用 A02 的服务端键值存储先例，命名空间 `fouc:mcp-client:v1:` / `fouc:mcp-code:v1:`），无新表或 migration。
- authorize 要求真实 verified 会话且为该工作区现役成员；同意表单隐藏字段经 BETTER_AUTH_SECRET 派生密钥的 HMAC 签名（10 分钟），POST 需可信 Origin。token 端点在签发前重查成员与邮箱验证；签发的令牌就是标准 PAT（`fouc_pat.` 前缀、SHA-256 存储、name 为 `mcp:<client>`），撤销/到期逐请求查库即时生效，与手工 PAT 同一验证路径。
- redirect URI 仅接受 HTTPS 或 loopback HTTP（无 fragment/credentials/query）；loopback 端口可变（RFC 8252）。scope 仅 `read`/`write`；`resource` 不匹配返回 `invalid_target`。RFC 7009 `/revoke` 对未知令牌恒返回成功，不泄露存在性。
- 会话缺失（无 Cookie）的请求返回 401 而非 403，使无凭证的 MCP 客户端能收到发现挑战；携带 Cookie 的请求仍完整执行 A01 Origin/CSRF 边界。

## 验证

```powershell
bun test backend/src/identity
pnpm exec tsc --noEmit -p backend/tsconfig.json
pnpm exec eslint --no-ignore backend/src/identity
```

测试通过 Node `http` 的真实随机端口和普通 PostgreSQL 角色执行，使用 D03 的唯一命名临时数据库创建/清理机制，不向开发主库 seed。包含密码哈希、验证 token 失效/伪造、Cookie/CORS/CSRF、成员隔离、会话撤销、邮件重试和地址伪造限流验证。

版本依据与参考：官方 [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)、[邮箱密码](https://better-auth.com/docs/authentication/email-password)、[会话管理](https://better-auth.com/docs/concepts/session-management)、[Hono](https://better-auth.com/docs/integrations/hono)、[Cookie 限制](https://better-auth.com/docs/concepts/cookies)、[SMTP TLS](https://nodemailer.com/smtp)。PostgreSQL skill 的连接复用与最小权限规则用于持久化边界；租户 RLS 不作用于全局身份表，也不被认证模块绕过。
