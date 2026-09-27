# A01 · 邮箱与会话验收

日期：2026-09-26。模块：`backend/src/identity/`。

主代理复核 config/service/http/email/identity 与 README，运行 `bun test backend/src/identity`：**15 tests / 167 assertions / 0 failures**；整体 backend 类型检查通过。测试使用真实 Node HTTP 端口、普通 PostgreSQL 应用角色与三个唯一临时数据库，结束后逐一删除验证，不 seed 主库。

## 通过的实际流程

- 注册参数验证、UUID、随机盐密码哈希；注册不隐式创建租户、不允许未验证邮箱登录。
- 捕获式测试邮件中的真实验证 token 完成验证；过期/伪造 token 拒绝；验证本身不创建会话，随后密码登录生成数据库会话。
- HttpOnly、host-only、SameSite Cookie 与精确 CORS/Origin；非法重定向、CSRF、过大请求及伪造转发 IP 均被拒绝或正确限流。
- 会话读取、单个/其他/全部撤销、登出、过期与跨用户撤销边界真实往返，关闭 Cookie session cache，不依赖旧 Cookie 缓存放行。
- 三种 Tauri origin 在 HTTPS 代理配置下返回 Secure/SameSite=None；不宣称已验证真实 WebView 第三方 Cookie 策略。
- SMTP 缺配置启动前报错，要求 TLS；测试邮件通道故障后重发返回脱敏可重试 503，恢复后验证成功。密钥、token、验证 URL 不进入诊断日志。

## 明确边界

测试使用 Nodemailer 捕获 transport，没有向外网邮箱投递。Better Auth 注册防枚举语义返回统一 200 并可能捕获发送失败：仅代表受理注册，不表示邮件送达；账号保持未验证，页面须提供重发入口。

内存限流仅单进程，Z03 多副本需共享限流。A01 只认证全局身份，Workspace 成员资格仍由 O01/P 系列校验。业务路由接线、SSO/PAT/登录界面分别由后续任务完成。

Better Auth 1.7.6 官方包的 utils peer 声明与本体依赖存在版本警告；没有强制全局 override。当前真实鉴权全流程与类型检查通过，依赖升级时继续回归。

# A03 · PAT 与统一服务端身份

日期：2026-09-26。主代理审阅 access policy、token format、session access、token service、opaque request context/refresh 与 identity 变更，并独立重跑：

```powershell
bun test backend/src/identity
pnpm backend:typecheck
```

结果 **38 passed / 0 failed，1147 assertions**，其中 PAT 23 项（19 真实 Node HTTP/PostgreSQL，4 单测）。所有临时数据库由 helper 创建闭包清理确认不存在；主库未写入测试记录。

- PAT 为 256-bit 随机秘密，包含公开 workspace/token UUID 定位，整串 SHA256 仅存 hash；恒时摘要比较；明文只返回创建响应一次。
- `read`/`write` 显式匹配，不相互隐含，更不授予页面 ACL 或管理权限。Session-only 创建/列出/撤销自己的 token，每次事务重新检查已验证用户、有效 session 和成员资格。
- 认证查询仅限 token workspace，交叉租户与修改定位失败；到期、撤销、成员删除、用户未验证及未知持久化 scopes 即时生效；没有 bearer→cookie 回退。
- Session/PAT 统一签发不可变服务端 context；客户端的 actor/user/kind/task 不能覆盖。长连接逐操作 `refresh` 仅接受同实例私有 proof，重查活态，不保存 bearer 明文或信任序列化快照。
- 所有错误脱敏；Cookie-only 原 A01 入口也明确拒绝 Authorization，保留现有 API。测试实例使用官方 customStorage 隔离模块全局限流桶，原实际 socket IP 和 429 测试仍通过。

边界：不是页面授权（P03）、MCP OAuth 或最终 API 路由装配（A00/Z03）。已开始的操作不会自动终止，后续动作必须重新 authenticate/refresh 并在业务事务内授权。生产必须 TLS，代理日志不能记录 Authorization/Cookie 或一次性 PAT 响应。

# A02 · OAuth 与 OIDC/SSO 身份

日期：2026-09-26。主代理审阅 oauth-config/oauth-http/oauth-provider/oauth-state/oidc-test-provider 与 README，复核 Better Auth 1.7.6 genericOAuth 官方路径，并独立重跑全部验证（先构建后 lint，避免 `--no-ignore` 扫到 3.1 MB 一次性冒烟 bundle）：

```powershell
bun test backend/src/identity
pnpm backend:typecheck
pnpm exec eslint --no-ignore backend/src/identity
bun build backend/src/identity/oauth-node-smoke.ts --target=node --format=esm --outfile backend/src/identity/.runtime/oauth-node-smoke.mjs
Copy-Item backend/src/database/knowledge/current.sql backend/src/identity/.runtime/current.sql
node --env-file=.env.knowledge.local backend/src/identity/.runtime/oauth-node-smoke.mjs
```

结果：**79 tests / 0 fail / 1633 assertions**（A02 新增 41 项），类型检查与定向 lint 通过；Node 24.16.0 冒烟在一次性 PostgreSQL/HTTP 上 **PASS**（真实 discovery/JWKS/RS256、S256、nonce 拒绝、错误恢复、稳定身份、不落盘 provider token），临时库创建后删除确认不存在。

## 通过的实际流程

- 内嵌标准协议测试 IdP（真实 Node HTTP + RSA/JWKS + 精确 redirect 注册 + S256 + 一次性授权码 + 实签 ID Token）：OIDC 全回调建立全局用户；不可变 subject 回到同一 UUID 且不覆盖本地已验证邮箱；普通 OAuth 走服务端 userinfo 且要求 `email_verified`。
- 两个有效 code 复用同一 state 仅一次成功（verification 表单次消费标记 + 官方 state/Cookie 校验）；标记过期清理有界且不删他人记录。
- 显式 link 要求 15 分钟内新鲜已验证会话；撤销/切换会话、邮箱不符、subject 已归属他用户均拒绝；禁止按邮箱隐式合并，未验证本地账号不可被外部身份接管。
- issuer/provider 混用、攻击者回调 URL、任意 provider/scope/issuer 注入、前端直交 ID Token、无 state 发起全部拒绝；nonce 缺失/错误的真实 IdP token 拒绝且不建会话。
- `access_denied` 与 `oauth_provider_error` 脱敏（外部 error_description 不进重定向）；token/redirect/网络类失败仅能用全新流程恢复；服务类错误复用 A01 的 503 `AUTH_UNAVAILABLE`。
- SSRF/DNS：私网/保留地址默认拒绝、解析全部地址并固定 socket、不跟随重定向、JWKS 重定向在带凭证请求前拒绝；discovery 失败不阻塞邮箱登录且无需重启重试；每请求 8 秒/128 KiB 预算。
- provider access/refresh/ID token 仅在当次流程内使用，account hooks 置空落库并关闭账户 Cookie；`get-access-token`/`refresh-token`/`account-info` 对 HTTP 关闭；`/providers` 只暴露 `{id,name,kind}`。
- OAuth 发起每 IP 20/min、显式 link 10/min，继续采用真实 socket IP 与共享 rateLimitStorage 接口；伪造转发头不影响限流计数。

## 明确边界

测试 IdP 为本地标准协议实现，未调用外网真实企业 IdP，也未声称通过 OpenID 认证；SSO 浏览器窗口回跳、Tauri WebView Cookie 转接与登录 UI 属 A04/Z03，MCP OAuth 2.1 属 K02，SAML/SCIM/自助动态 IdP 注册未实现。会话/Cookie/限流边界沿用 A01/A03 记录。

另记：本次验收前把本地开发端点从 Windows→WSL loopback 转发改为 WSL NAT 地址直连（`compose.knowledge.yaml` 端口绑定与 `knowledge-infra.mjs` 端点同步）：loopback 转发在并发连接池下返回 ECONNREFUSED，NAT 地址直连 100 并发全通；凭据与端口不变，外部 LAN 仍不可达。
