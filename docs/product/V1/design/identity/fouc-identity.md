# Fouc 统一身份与授权

## 账户归属

Fouc 只有一套账户。邮箱密码、邮箱验证、企业 SSO 与数据库会话由 `backend/server/src/platform/identity` 提供，接口统一为 `/api/auth/*`。身份表由 `backend/server/src/platform/database/identity/schema.ts` 定义，知识库和其它资源只引用同一个用户 UUID。

PostgreSQL 数据库统一命名为 `fouc`；账户表位于全局 `auth` schema，其中 `user`、`session`、`account`、`verification` 由身份模块拥有。知识库业务表位于 `knowledge` schema，仅通过用户 UUID 引用全局账户。

`backend/server/src/platform/database/schema.ts` 组合各模块的表定义；全局初始化、检查与当前 DDL 位于 `backend/server/src/platform/database/initialize*.ts`、`current.sql`。命令为 `bun backend/server/scripts/database.ts [init|status|check]`、`bun backend/server/scripts/database-schema.ts [--write|--check]`。初始化只接受空数据库，没有迁移链、旧 schema 分支或兼容适配器。开发环境集中配置在忽略提交的 `.env.fouc.local`；内置开发账户由 `backend/server/scripts/auth-admin.ts` 创建。

前端 `src/features/identity` 挂载于应用根布局。所有模块通过 `useIdentity()` 获取同一会话，不自行发起模块登录流程。侧栏设置下方是账户入口；展开时显示头像、名称与邮箱，收起时保留头像和内置提示。登录模态框和独立 `/auth` 页面共用同一表单，验证与 SSO 回调仍有独立页面。

登录后的账户入口打开操作菜单，提供个人信息、状态选择及退出登录。个人信息的显示名称通过全局 `/api/auth/update-user` 保存，服务端校验与会话刷新沿用身份模块。当前设备状态包含在线、离开、勿扰、忙碌；按用户 UUID 保存本机偏好，同源窗口同步。在线时五分钟无输入自动显示离开，重新操作恢复在线；浏览器断网显示离线，重连恢复偏好。设备状态不代表其它设备的在线情况，不参与权限判断，勿扰目前仅表示用户状态，不改变通知策略。

## 会话闭环

- 初次加载检查数据库会话；同时发起的检查共用请求。
- 密码验证成功后再读取会话。未保留 Cookie 不显示登录成功，也不跳回模块继续触发登录。
- 只接受已验证邮箱、未到期会话，以及匹配的 user/session 主体。
- 登录成功刷新全局身份、关闭模态框并显示提示。注册请求先进入邮箱验证阶段，完成验证后登录；不会把注册受理当成已登录。
- 会话通过 HttpOnly Cookie 传输，不把会话令牌写入 localStorage。焦点恢复、到期计时、业务请求 401 和同源窗口的 BroadcastChannel 同步会话变化。
- 退出先撤销服务器会话，成功后切换为访客。撤销失败保留已知身份并显示失败，不宣称退出成功。迟到的会话检查不能恢复已经退出或过期的身份。
- 知识库 QueryClient 随用户身份挂载，退出、身份失效或换账户都会卸载该身份的查询缓存和订阅。
- 当前工作台模块放入 URL 的 `view` 参数，刷新和认证返回都能恢复模块。

`src/lib/fouc-api-endpoint.ts` 是全局服务地址解析；`src/lib/authenticated-fetch.ts` 是需要会话的业务传输入口。知识库只定义自己的资源路径。开发环境中若 API 与网页均为 HTTP loopback，会对齐 localhost/127.0.0.1 主机名，使 Cookie 在同一站点使用。远程地址和生产配置不会被改写。

## 身份与资源授权

身份回答“当前是谁”；资源授权回答“能对这个资源做什么”。账户名称、邮箱或登录成功都不授予管理员权限。

知识库的 `backend/server/src/modules/knowledge/access` 将全局会话或工作区 PAT 转为服务器拥有的请求上下文；实时检查工作区成员关系、角色和令牌范围。`backend/server/src/modules/knowledge/permissions` 继续检查文件夹、页面及操作级 ACL。前端显隐和只读状态来自这些真实结果，后端仍独立校验每次读取和写入。403 保留登录身份，401 触发全局会话失效处理。

其它模块应消费同一个身份入口，在自己的业务边界检查资源授权，不能新增模块账户。桌面本机进程的 IPC/Bearer 安全令牌是设备通信凭据，不是另一套用户账户，也不能作为云端用户授权。

## 访客知识库

未登录或账户服务暂不可用时，知识库进入明确标注的“本机 · 个人”空间。访客可创建个人知识库及文档、编辑正文和标题、星标、标记草稿、删除与恢复文档。内容仅保存在当前浏览器，不调用需要身份的云端业务接口，不创建隐藏的访客用户。

团队知识库、成员授权、云端评论、AI 服务和协作需要已登录账户与相应资源授权。本机入口提供登录引导；登录后的知识库菜单仍保留本机入口。本机内容不会被清空或自动上传，避免把设备上的私人内容隐式写入团队空间。

浏览器存储失败时不会将内容发布为“已保存”。本机知识库不是云端备份；清除该站点数据会清除本机文档。

## 配置与验证

Web 与桌面共同使用 `NEXT_PUBLIC_FOUC_API_URL`；桌面注册及重发邮件使用 `NEXT_PUBLIC_FOUC_WEB_URL` 作为系统浏览器可访问的验证落地页，不能回跳到内部 WebView 地址；身份服务使用 `BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`、`FOUC_AUTH_TRUSTED_ORIGINS`、`FOUC_AUTH_COOKIE_MODE` 与 `FOUC_AUTH_PROVIDERS`。可信 Origin 必须明确列出，CSRF、Cookie 安全属性和限流继续启用。生产环境需配置 SMTP 才能发送验证邮件；当前开发运行时把验证链接写入服务日志。SSO 只显示服务器配置的提供方。

已验证 localhost 和 127.0.0.1 两种地址：访客创建/编辑/刷新保留、注册界面、admin 登录、连续三次刷新、切回本机内容、退出登录。真实隔离数据库测试覆盖注册、邮箱验证、会话撤销与到期、SSO、安全边界、PAT 和资源 ACL；测试数据库在结束后移除。

## 桌面传输

`backend/server/src/entrypoints/server.ts` 是全局服务装配入口，将身份与资源模块挂载于同一个监听器；本机设备 sidecar (`backend/device/src/entrypoints/index.ts`) 的随机 IPC token 只保护设备操作。

Tauri 构建读取同一个 `NEXT_PUBLIC_FOUC_API_URL`，`get_fouc_service_origin` 返回固定的服务地址。`src/lib/fouc-service-fetch.ts` 与 `src-tauri/src/service_http.rs` 提供受限原生 HTTP 能力：仅主窗口、本产品页面和固定服务 `/api/*` 可调用；Cookie 保留在 WebView 的持久 HttpOnly 存储中；JS 不能指定 Cookie、Origin 或设备令牌，Set-Cookie 不返回 JS。远程服务只接受 HTTPS，本机开发允许 HTTP loopback；不关闭 CSRF 或证书校验。

桌面协作连接先通过已登录 HTTP 请求获取 20 秒、单次、路径绑定的 socket ticket。服务端握手消费后继续检查当前会话、成员关系及资源 ACL，退出后旧 ticket 不能恢复已撤销的会话。Web 继续使用浏览器 Cookie；两端共享同一账户与授权模型。

## Windows 客户端验收

使用实际 Release `fouc.exe` 的 WebView2（`http://tauri.localhost`、原生 Tauri 能力），已通过：

- 访客进入知识库、错误密码提示、admin 登录、连续三次刷新仍保持身份，无 `/auth` 循环。
- 注册请求受理、验证邮件重发、未验证邮箱拒绝登录、真实验证 token 核验、验证后登录及刷新。
- 真实 HTTP OIDC 测试 IdP 的授权、RSA/JWKS、PKCE、回调、全局身份刷新与退出。未使用企业真实账号或伪造授权响应。
- 非成员知识库请求返回 404，避免泄露资源存在性；被拒绝后保留身份；本人知识库及文件夹创建通过。
- 实际 WebSocket 握手返回 101，单次凭证的重放被拒绝；Bun 原始 Request 的升级行为有独立回归测试。
- HttpOnly Cookie 不进入 `document.cookie` 或 JS 响应头；调用设备 sidecar 或其它目标地址被原生网络桥拒绝。

后端身份、SSO、权限与隔离集成测试使用真实一次性 PostgreSQL 数据库。验证邮件采用开发传输，生产仍需配置 SMTP；SSO 测试使用本地标准协议 IdP，实际企业提供方需在 `FOUC_AUTH_PROVIDERS` 配置。
