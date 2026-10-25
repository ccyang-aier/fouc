# Fouc 统一身份与授权

## 账户归属

Fouc 只有一套账户。邮箱密码、邮箱验证、企业 SSO 与数据库会话由 `backend/server/src/platform/identity` 提供，接口统一为 `/api/auth/*`。身份表由 `backend/server/src/platform/database/identity/schema.ts` 定义，各业务资源只引用同一个用户 UUID。

PostgreSQL 数据库统一命名为 `fouc`；账户表位于全局 `auth` schema，其中 `user`、`session`、`account`、`verification` 由身份模块拥有。项目、任务、聊天等业务表位于 `resources` schema；当前项目是工作台业务范围，任务、资产、成员与聊天默认以真实 projectId 隔离。项目通过 `projectId` 与项目成员授权，所有业务模块统一引用全局用户 UUID。

`backend/server/src/platform/database/schema.ts` 组合各模块的表定义；全局初始化、检查与当前 DDL 位于 `backend/server/src/platform/database/initialize*.ts`、`current.sql`。命令为 `bun backend/server/scripts/database.ts [init|status|check]`、`bun backend/server/scripts/database-schema.ts [--write|--check]`。初始化只接受空数据库，没有迁移链、旧 schema 分支或兼容适配器。开发环境集中配置在忽略提交的 `.env.fouc.local`；内置开发账户由 `backend/server/scripts/auth-admin.ts` 创建。

前端 `src/features/identity` 挂载于应用根布局。所有模块通过 `useIdentity()` 获取同一会话，不自行发起模块登录流程。侧栏底部左侧是账户入口，右侧是主题切换与设置图标：未登录时显示虚线头像与登录提示；登录后单行显示头像和名称，当前设备状态通过头像角标及账户菜单表达，邮箱放在账户菜单中；收起时保留头像和内置提示。账户入口、评论与在线成员列表共用头像组件，已设置图片时显示真实头像，默认采用白色姓名首字母；账户入口和个人资料使用黑色圆形背景，其它业务沿用强调色。账户入口保留在线状态角标。账户菜单中的个人信息、切换账户与退出登录使用半实心双色图标，与主导航保持相同的轮廓与局部填充规范；切换账户使用双人标识，退出登录使用开门标识并保留危险红色。

账户入口沿用主侧栏的紧凑密度：展开时高 40px、头像 28px、圆角 8px，采用浅灰底的紧凑身份栏，名称按剩余宽度截断；账户菜单宽 200px、圆角 8px，菜单操作行高 30px，展开侧栏时与账户入口的左边缘对齐，“设置状态”与子菜单箭头在同一行右侧紧邻排列。收起且未登录时 Tooltip 只显示“点击登录”，悬停和键盘聚焦只将圆形虚线描边改为实线前景色，不增加矩形底色。品牌标复用主导航的 `FoucMark` 和正式 icon 资源，不使用截图裁剪图。

登录模态框与独立 /auth 页面共用蓝白 GradientASCII 与表单的左右分栏布局，窄屏只保留表单。无 SSO 时最小高度为 480px，注册、错误反馈和已配置 SSO 随内容自然增高。src/components/backgrounds/gradient-ascii.tsx 承载用户提供的 WebGL2 背景实现；AuthBackdrop 只配置 horizon、四段蓝白色、字符、密度、鼠标扰动及点击波纹等参数。左侧保留品牌与简洁产品文案轮播，删除模拟任务卡、步骤及进度条，充分展示 ASCII 场景。背景在不可见和后台时暂停，恢复时继续绘制，只维护一套正常动效；清理 GPU 资源时不主动丢失仍可能被 React StrictMode 复用的 canvas context。个人资料封面单独使用 ProfileBackdrop，保留原银色缎带视觉。

登录与个人资料模态框保留轻遮罩和 3px 背景模糊。邮箱、密码、注册校验、显隐和提交反馈保持原实现；SSO 只显示服务端配置。原生 dialog 管理焦点、Escape、关闭与焦点返回，登录先聚焦邮箱。全局精灵使用独立 manual popover 顶层宿主，几何位置和拖拽边界始终属于视口，不受 dialog 的 transform 或 overflow 裁切；为保持原生模态交互，宿主逻辑上位于当前模态框内，但精灵、工具栏、菜单与气泡在自己的全窗口浮层绘制。气泡使用不截获 Escape 的被动 status 展示，保留拖拽跟随和视口避让。空白区域穿透，不能挡住表单；开关弹窗和全屏切换保持同一实例、位置及状态。所有表单和个人资料操作仍遵循全局反馈和 30px 紧凑按钮规范。

本机开发内置账户包括 `admin@fouc.local`（Fouc Admin，默认密码 `FoucAdmin-2026-mK7qXz`）与 `collaborator@fouc.local`（林沐，默认密码 `FoucCollab-2026-pN8rVz`）。创建后者时，在运行 `bun backend/server/scripts/auth-admin.ts` 的进程中设置 `FOUC_ADMIN_EMAIL=collaborator@fouc.local`、`FOUC_ADMIN_NAME=林沐`、`FOUC_ADMIN_PASSWORD=FoucCollab-2026-pN8rVz`，只初始化该邮箱，不改动其他账户。协作账户按需要作为普通成员加入具体项目，业务能力仍由实际项目与资源权限决定；内置账户没有绕过资源权限的特权。

登录后的账户入口打开操作菜单，提供个人信息、状态选择、切换账户及退出登录。切换账户打开登录表单并保留当前会话，取消或密码验证失败不退出原账户；新账户登录成功后，通过权威会话刷新替换主体并更新各资源视图。登录成功、退出成功、手动设置设备状态和切换成功通过共享 `AppAlert` 的底部深色浮动提示反馈，连续操作更新提示内容和关闭计时；不会把自动离开等后台变化作为手动操作提示。个人信息的显示名称通过全局 `/api/auth/update-user` 保存，服务端校验与会话刷新沿用身份模块。退出入口先确认，再撤销服务器会话；失败时保留身份并在确认框内显示错误。账户操作按钮的忙碌状态使用共享三点 loading，保留尺寸、可访问名称和防重复提交。当前设备状态包含在线、离开、勿扰、忙碌；按用户 UUID 保存本机偏好，同源窗口同步。在线时五分钟无输入自动显示离开，重新操作恢复在线；浏览器断网显示离线，重连恢复偏好。设备状态不代表其它设备的在线情况，不参与权限判断，勿扰目前仅表示用户状态，不改变通知策略。

## 会话闭环

- 初次加载检查数据库会话；同时发起的检查共用请求。
- 密码验证成功后再读取会话。未保留 Cookie 不显示登录成功，也不跳回模块继续触发登录。
- 只接受已验证邮箱、未到期会话，以及匹配的 user/session 主体。
- 登录成功刷新全局身份、关闭模态框并显示提示。注册请求先进入邮箱验证阶段，完成验证后登录；不会把注册受理当成已登录。
- 会话通过 HttpOnly Cookie 传输，不把会话令牌写入 localStorage。焦点恢复、到期计时、业务请求 401 和同源窗口的 BroadcastChannel 同步会话变化。
- 退出先撤销服务器会话，成功后切换为访客。撤销失败保留已知身份并显示失败，不宣称退出成功。迟到的会话检查不能恢复已经退出或过期的身份。
- 业务查询、订阅与私有缓存按身份、来源及具体项目分区；项目选择偏好按主体独立保存。退出、身份失效、换账户或权限撤销时不能展示上一主体的私有资源。
- 当前工作台模块放入 URL 的 `view` 参数，刷新和认证返回都能恢复模块。

`src/lib/fouc-api-endpoint.ts` 是全局服务地址解析；`src/lib/authenticated-fetch.ts` 是需要会话的业务传输入口。各业务模块只定义自己的资源路径。开发环境中若 API 与网页均为 HTTP loopback，会对齐 localhost/127.0.0.1 主机名，使 Cookie 在同一站点使用。远程地址和生产配置不会被改写。

## 身份与资源授权

身份回答“当前是谁”；资源授权回答“能对这个资源做什么”。账户名称、邮箱或登录成功都不授予管理员权限。

业务模块从全局会话取得服务器拥有的身份上下文，并按真实项目成员、资源归属与具体操作权限独立校验每次读取和写入。前端显隐和只读状态来自这些真实结果，后端仍独立校验每次操作。403 保留登录身份，401 触发全局会话失效处理。

其它模块应消费同一个身份入口，在自己的业务边界检查资源授权，不能新增模块账户。桌面本机进程的 IPC/Bearer 安全令牌是设备通信凭据，不是另一套用户账户，也不能作为云端用户授权。

## 访客与资源选择

登录态只决定主体身份与具体操作许可，不决定整个模块的数据模式。全产品不设额外工作空间；项目是统一工作台业务隔离域，本机、服务端、设备能力由资源和操作明确选择。登录或退出不得隐式上传、清空或替换当前内容。

当前实现允许访客使用本机范围内的项目数据，浏览器存储失败时不能报告“已保存”；清除站点数据会删除这类浏览器数据。它不是长期的访客服务端资源模型。面向全产品的受限访客主体、服务端私有资源、保留规则与登录承接仍待设计和实现，不能把浏览器存储当成统一访客能力。授权原则见 [项目结构设计](../arch/fouc-project-structure-design.md#5-访客资源与登录承接)。

## 配置与验证

Web 与桌面共同使用 `NEXT_PUBLIC_FOUC_API_URL`；桌面注册及重发邮件使用 `NEXT_PUBLIC_FOUC_WEB_URL` 作为系统浏览器可访问的验证落地页，不能回跳到内部 WebView 地址；身份服务使用 `BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`、`FOUC_AUTH_TRUSTED_ORIGINS`、`FOUC_AUTH_COOKIE_MODE` 与 `FOUC_AUTH_PROVIDERS`。可信 Origin 必须明确列出，CSRF、Cookie 安全属性和限流继续启用。生产环境需配置 SMTP 才能发送验证邮件；当前开发运行时把验证链接写入服务日志。SSO 只显示服务器配置的提供方。


## 桌面传输

`backend/server/src/entrypoints/server.ts` 是全局服务装配入口，将身份与资源模块挂载于同一个监听器；本机设备 sidecar (`backend/device/src/entrypoints/index.ts`) 的随机 IPC token 只保护设备操作。

Tauri 构建读取同一个 `NEXT_PUBLIC_FOUC_API_URL`，`get_fouc_service_origin` 返回固定的服务地址。`src/lib/fouc-service-fetch.ts` 与 `src-tauri/src/service_http.rs` 提供受限原生 HTTP 能力：仅主窗口、本产品页面和固定服务 `/api/*` 可调用；Cookie 保留在 WebView 的持久 HttpOnly 存储中；JS 不能指定 Cookie、Origin 或设备令牌，Set-Cookie 不返回 JS。远程服务只接受 HTTPS，本机开发允许 HTTP loopback；不关闭 CSRF 或证书校验。
