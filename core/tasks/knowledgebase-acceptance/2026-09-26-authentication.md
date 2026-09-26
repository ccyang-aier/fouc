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
