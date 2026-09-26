# A01 · 邮箱与会话验收

日期：2026-09-26。模块：`backend/src/knowledge/auth/`。

主代理复核 config/service/http/email/identity 与 README，运行 `bun test backend/src/knowledge/auth`：**15 tests / 167 assertions / 0 failures**；整体 backend 类型检查通过。测试使用真实 Node HTTP 端口、普通 PostgreSQL 应用角色与三个唯一临时数据库，结束后逐一删除验证，不 seed 主库。

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
bun test backend/src/knowledge/auth
pnpm backend:typecheck
```

结果 **38 passed / 0 failed，1147 assertions**，其中 PAT 23 项（19 真实 Node HTTP/PostgreSQL，4 单测）。所有临时数据库由 helper 创建闭包清理确认不存在；主库未写入测试记录。

- PAT 为 256-bit 随机秘密，包含公开 workspace/token UUID 定位，整串 SHA256 仅存 hash；恒时摘要比较；明文只返回创建响应一次。
- `read`/`write` 显式匹配，不相互隐含，更不授予页面 ACL 或管理权限。Session-only 创建/列出/撤销自己的 token，每次事务重新检查已验证用户、有效 session 和成员资格。
- 认证查询仅限 token workspace，交叉租户与修改定位失败；到期、撤销、成员删除、用户未验证及未知持久化 scopes 即时生效；没有 bearer→cookie 回退。
- Session/PAT 统一签发不可变服务端 context；客户端的 actor/user/kind/task 不能覆盖。长连接逐操作 `refresh` 仅接受同实例私有 proof，重查活态，不保存 bearer 明文或信任序列化快照。
- 所有错误脱敏；Cookie-only 原 A01 入口也明确拒绝 Authorization，保留现有 API。测试实例使用官方 customStorage 隔离模块全局限流桶，原实际 socket IP 和 429 测试仍通过。

边界：不是页面授权（P03）、MCP OAuth 或最终 API 路由装配（A00/Z03）。已开始的操作不会自动终止，后续动作必须重新 authenticate/refresh 并在业务事务内授权。生产必须 TLS，代理日志不能记录 Authorization/Cookie 或一次性 PAT 响应。
