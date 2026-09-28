# DTS Connector 详细设计

## 一、文档目的

本文定义 DTS 作为 Fouc 首个问题系统 Connector Provider 的产品流程、认证方式、运行时结构、API 能力、会话恢复、安全边界与验证标准。

DTS Connector 是 [Fouc Connector 整体架构设计](./connector-architecture.md) 下的独立 Provider。它直接面对 DTS，不与 Figma、飞书等平台共享 API Client，也不通过一个中央业务 Router 间接选择目标平台。

## 二、已知约束与设计结论

### 2.1 平台约束

- DTS 没有可用的 OpenAPI、OAuth、服务账号或正式 Token 机制；
- DTS 位于公司内网，当前可通过内网 DNS 直连，也可经企业代理访问；
- 登录依赖 Uniportal SSO 和 Cookie 会话；
- 未认证 API 可能返回 HTTP 200、空响应体和 `hw-ajax-redirect`，不能只判断状态码；
- Node/Bun 默认 Mozilla CA 集合不包含企业 CA，但 Windows 系统证书库已包含所需根证书；
- DTS 前端声明大量读写 API，但 V1 只开放经过验证的只读能力。

### 2.2 已验证事实

以下是既有受控测试观察，只用于说明设计依据，实际平台行为需在接入时重新验证：

- Node 22 和 Bun 1.4.2 均可完成登录与只读 API 调用；
- 登录完成后可直接调用 DTS API，不需要成功完成 `ssoproxysvr/v2/tickets` 跳转；
- 第一次成功访问 DTS 后会形成 DTS 应用会话；
- 当前用户身份、筛选器、表头、分页列表、详情、关联关系和权限接口均可调用；
- 同账号第二次登录不会立即使第一会话失效；
- 同一会话在 1、5、15、30 分钟检查时均有效；
- `cftk`、Origin、Referer、`X-Requested-With` 和语言头不是当前列表读取的硬依赖；
- 空 JSON 对象不会报错，而会返回大范围数据，因此必须由 Provider 固定请求结构和范围。

上述结论证明只读 Connector 可行，但不代表 Cookie 的正式绝对超时为 30 分钟，也不代表写接口不需要 CSRF 或更严格的权限。

### 2.3 核心设计决策

V1 采用：

```text
认证面：Tauri 隔离 WebView2 承载官方 SSO 页面
数据面：本地 Bun sidecar 调用 DTS HTTP API
凭据面：WebView Profile + sidecar 内存 CookieJar
执行位置：desktop / desktop_relay
能力范围：个人身份、只读、显式白名单
```

纯 HTTP 逆向登录不作为 V1 唯一认证路径。它可以保留为诊断或未来无人值守模式的候选，但不能让整体可用性依赖当前密码编码、指纹字段和 SSO 登录报文长期不变。

## 三、Provider 定义

```ts
const dtsProvider: ConnectorProviderDefinition = {
  id: 'dts',
  name: 'DTS',
  description: '查询 DTS 工单、流程、关系和权限',
  authMethods: [{ kind: 'managed_web_session' }],
  placements: ['desktop', 'desktop_relay'],
  capabilities: [
    dtsTicketsList,
    dtsTicketsGet,
    dtsTicketsRelations,
    dtsTicketsPermissions,
    dtsFiltersList,
  ],
  configurationSchema: dtsInstanceConfigSchema,
}
```

### 3.1 Instance 配置

```ts
interface DtsInstanceConfig {
  baseUrl: 'https://clouddragon.xfusion.com/dts/DTSPortal'
  defaultFilter: DtsFilterId
  allowedFilters: DtsFilterId[]
  maxPageSize: number
  networkMode: 'direct' | 'proxy' | 'auto'
  proxyUrl?: string
}
```

V1 中 `baseUrl` 固定为受信任 DTS 地址，不允许用户或 Agent 传入任意主机。默认过滤器为 `myTodos`，分页上限应取保守值，例如 50。

## 四、用户操作旅程

### 4.1 发现与连接

1. 用户进入“连接器”目录并选择 DTS；
2. 详情页说明 DTS 需要公司网络、由本机执行、V1 只读；
3. 用户点击“连接”；
4. Fouc 确认本机 sidecar 可用并创建一次有时限的登录交互；
5. Tauri 打开受管认证窗口，由真实 workspace 导航暴露 DNS、TLS、VPN 或 SSO 问题；
6. 身份验证失败时 Instance 回到 `needs_user_action`，界面显示可操作错误，不把窗口打开视为连接成功。

### 4.2 官方页面登录

预检成功后，Fouc 显示：

> Fouc 将在独立窗口中打开 DTS 官方登录页。账号密码只提交给 DTS，Fouc 不读取或保存密码。登录完成后，Fouc 将使用当前会话读取你有权限访问的工单。

用户确认后：

1. Tauri 创建 label 为 `dts-auth-{instanceId}` 的独立 WebViewWindow；
2. 顶层页面导航到 DTS workspace，由 DTS 跳转到 Uniportal；
3. 用户在官方页面完成密码、验证码或 MFA；
4. 登录后页面回到 DTS workspace；
5. Tauri 在异步任务中读取对应 URL 的 Cookie，包括 HttpOnly/Secure Cookie；
6. 原生层把 Cookie 直接提交给本地 sidecar 的受保护内部端点；
7. sidecar 调用 `getUserInfo` 验证账号；
8. 验证成功后关闭认证窗口并创建 ConnectorInstance。

认证窗口是独立顶层 WebView，不是 Fouc React 页面中的 iframe。远程页面不能获得 Fouc IPC 权限。

### 4.3 连接配置

身份确认后，用户配置：

- Instance 名称；
- 默认视图，如“我的待办”；
- 允许查询的视图；
- 是否允许 Agent 自动执行只读查询；
- 项目级可见范围；
- 是否允许 Web 任务通过当前桌面执行。

连接完成后显示：

```text
DTS
状态：已连接
身份：已验证账号
权限：只读
执行位置：本机桌面
默认范围：我的待办
最近检查：刚刚
```

### 4.4 会话过期

当 sidecar 检测到会话失效：

1. 当前调用失败为明确的 `session_expired` / `authentication_required`；
2. Instance 变为 `needs_user_action`，健康状态变为 `degraded`；
3. Fouc 显示“DTS 登录已过期”，但不主动弹窗抢焦点；
4. 用户点击“重新连接”后再次进入受管 SSO 窗口；
5. 若专用 Profile 中官方 SSO 仍有效，页面可无密码完成跳转并重新交接 Cookie；否则由用户完成官方登录；
6. 连接成功后，用户或上层任务重新发起幂等读取。

自动 single-flight 刷新和原调用自动重放属于后续增强，不是当前 V1 的隐式承诺。

### 4.5 断开连接

断开时：

- 清空 sidecar 内存 CookieJar；
- 关闭并清理 DTS 专用 WebView 会话；
- 删除凭据引用和 Instance 授权；
- 停止后台健康检查；
- 删除非必要缓存；
- 保留不含敏感值的连接和调用审计。

## 五、组件结构

```text
src-tauri/
└── DTS Auth WebView Bridge
    ├── 创建/显示/隐藏认证窗口
    ├── 主导航域名约束
    ├── 异步读取 HttpOnly Cookie
    └── 直接转交 sidecar

backend/device/src/connectors/
├── repository.ts     Instance、心跳与调用审计
├── service.ts        生命周期、Provider Registry 与 Capability 调用
└── dts/
    ├── provider.ts   Provider Definition、白名单 API、TLS、超时与重试
    ├── cookie-jar.ts Cookie domain/path/secure/expiry 语义
    └── mapper.ts     DTS DTO → Fouc 最小领域输出
```

当前 V1 为保持最小实现，将上述职责收敛在 `backend/device/src/connectors/dts/{provider,cookie-jar,mapper}.ts`，边界不变；仅当第二个 Provider 或协议复杂度确实需要时再拆成更多文件。

Tauri 只实现系统能力桥。DTS 端点、请求体、数据映射和会话判断全部保留在 TypeScript sidecar。

## 六、认证窗口安全设计

### 6.1 窗口隔离

- 使用独立 window label，不匹配主窗口 capability；
- 不为 xFusion 远程域配置 Tauri remote capability；
- 不向页面注入 sidecar token、初始化脚本或业务数据；
- 禁用 DevTools、下载和非必要新窗口；
- 主框架导航仅允许明确的 DTS、Uniportal 和 SSO 域；
- 外部帮助链接交给系统浏览器，不在认证窗口内扩展信任域。

### 6.2 Cookie 提取

Tauri 2.11 的 WebView API 可以读取 HttpOnly 和 Secure Cookie。Windows WebView2 在同步命令或事件回调中读取 Cookie 可能死锁，因此必须从异步命令或独立任务执行。

Cookie 不经 React 状态、浏览器 localStorage、URL、日志或事件 payload。原生层只向本机 sidecar 发送允许域名的 Cookie，并使用只存在于 Rust 壳与 sidecar 进程环境中的独立内部令牌认证；普通前端 Bearer Token 无权调用 Cookie handoff 端点。

### 6.3 Cookie 存储

- WebView Profile 管理浏览器侧 SSO 状态；
- sidecar 使用完整、标准语义 CookieJar；
- sidecar 默认仅在内存保存当前运行会话；
- SQLite 只保存身份摘要、连接状态和非敏感配置；
- 如果后续确需跨重启持久化 Cookie，必须使用 OS Vault，并提供显式“记住登录”选项。

## 七、会话建立与恢复

### 7.1 会话建立

```text
Tauri WebView 完成 SSO
    ↓
提取 .xfusion.com / clouddragon.xfusion.com Cookie
    ↓
sidecar 建立 CookieJar
    ↓
GET /v1/getUserInfo 验证身份
    ↓
首次 DTS API 调用形成/刷新应用会话
    ↓
Instance = connected
```

实测表明 SSO 登录 Cookie 可直接调用 DTS；DTS 响应随后会下发应用会话 Cookie。产品实现应保留并更新完整 CookieJar，不通过手工最小化 Cookie 集合优化实现。

### 7.2 失效判定

DTS 未认证时可能返回 HTTP 200，因此采用组合判断：

```ts
const sessionExpired =
  response.headers.has('hw-ajax-redirect')
  || responseBody.length === 0
  || isUnexpectedContentType(response)
  || !matchesExpectedSchema(responseBody)
```

错误 JSON 也可能使用 HTTP 200，所有接口均需验证顶层 `status/error/result` 及具体 result schema。

### 7.3 自动恢复

- 同一 Instance 只允许一个刷新过程；
- 其他调用等待该刷新，不重复弹窗；
- 刷新成功后，幂等读取调用最多自动重放一次；
- 第二次仍失败则进入 `needs_user_action`；
- 认证失败不能通过切换代理或关闭 TLS 校验绕过；
- 密码过期、MFA 和验证码统一由官方登录窗口处理。

## 八、网络与 TLS

### 8.1 网络模式

- `direct`：公司网络内默认模式；
- `proxy`：显式使用企业代理；
- `auto`：先直连，只在 DNS、TCP 连接等网络失败时尝试已配置代理。

不能在认证拒绝、权限不足、协议错误或证书错误时自动切换代理，这些错误与路由无关。

### 8.2 系统 CA

Bun 默认 CA 集合无法验证 DTS 内部证书。Transport 应取得系统 CA 并传给 fetch：

```ts
import tls from 'node:tls'

const systemCa = tls.getCACertificates('system')

await fetch(url, {
  tls: { ca: systemCa },
})
```

开发运行也可使用 `bun --use-system-ca`。禁止使用 `NODE_TLS_REJECT_UNAUTHORIZED=0` 或 `rejectUnauthorized: false` 作为正式实现。

### 8.3 超时与重试

建议初始值：

- DNS/TCP/TLS/首字节总请求超时 15 秒；
- 身份验证和列表读取最多一次网络重试；
- 只对幂等读取、连接重置和明确的 502/503/504 重试；
- 遵守 `Retry-After`；
- 用户取消、权限不足、schema 错误和会话过期不走普通网络重试。

## 九、V1 Capability

### 9.1 `dts.identity.get`

调用当前用户接口，返回经过裁剪的身份信息。它用于连接验证和诊断，不向 Agent 暴露原始身份响应。

### 9.2 `dts.filters.list`

读取当前用户可用的首页视图。已观测到的视图包括：

```text
myTodos
myProcessed
myCreate
myFollowed
myOverdue
ccToMe
closed
unclosed
cancel
```

实际允许列表应由 Provider 校验服务端返回并与 Instance 配置取交集，不能相信 Agent 自由输入。

### 9.3 `dts.tickets.list`

内部端点：

```text
POST /v1/ticketlist/listByVersionAndHead
```

Provider 构造固定请求 DTO：

```ts
interface DtsTicketListInput {
  filter: DtsFilterId
  page: number
  pageSize: number
  keyword?: string
}
```

禁止把外部接口原始 body 暴露给 Agent。特别是空对象会触发大范围查询，因此 Provider 必须填充 `filterId`、`pageIndex`、`pageSize`、`queryAction` 等字段，并限制 pageSize。

### 9.4 `dts.tickets.get`

内部端点：

```text
GET /v1/getTicket?dtsNo={id}
```

返回流程、节点、业务字段、处理人和权限等详情。默认输出只包含任务需要的字段；完整节点数据按需裁剪，不能直接进入模型上下文。

### 9.5 `dts.tickets.relations`

内部端点：

```text
GET /v1/ticket/getRelationTickets?dtsNo={id}
```

返回关联工单的最小引用和关系类型。

### 9.6 `dts.tickets.permissions`

内部端点：

```text
POST /v1/ticket/getDtsPermit
```

V1 用于展示和评估权限，不据此自动执行写操作。

### 9.7 表头元数据

Connector 内部可以调用 `getTableHeadInfos` 理解列表字段，但它不是 Agent 业务 Capability。字段展示和排序配置由 Provider 使用并缓存短期结果。

## 十、数据契约与映射

### 10.1 列表摘要

```ts
interface DtsTicketSummary {
  id: string
  title: string
  status: string
  severity: string | null
  currentHandler: string | null
  creator: string | null
  createdAt: string | null
  productType: string | null
  productPath: string[]
  source: ExternalObjectRef
}
```

映射字段以运行时 schema 校验为准，例如 DTS 当前响应中的 `dtsBizNo`、`sBriefDescription`、`status`、`sSeverityNo`、`sCurrentHandler`、`creator` 和 `createAt`。

### 10.2 详情

```ts
interface DtsTicketDetail extends DtsTicketSummary {
  currentNode: DtsFlowNodeSummary | null
  flowState: string | null
  handlers: string[]
  fields: DtsFieldValue[]
  relations: ExternalObjectRef[]
  permissions: DtsPermissionSummary
}
```

外部响应中的 `nodeDatas`、`bizFieldInfos`、`flowConfig` 等可能很大且包含人员或内部字段。Mapper 应按明确白名单产生输出；原始响应仅在内存短暂存在，不写日志。

### 10.3 Fouc WorkObject 映射

DTS 工单可映射为 Fouc 的外部 WorkObject 引用，但 DTS 仍是权威来源：

```text
WorkObject
├── externalRef.connectorInstanceId
├── externalRef.externalId
├── title / status / assignees 快照
├── snapshotAt
└── contentDigest
```

Fouc 不复制完整工单历史。需要最新事实时重新调用 DTS。

## 十一、权限与数据最小化

### 11.1 默认范围

- 默认只允许 `myTodos`；
- 用户显式开启其他个人视图；
- 不提供空过滤器和全局查询；
- 不允许 Agent 修改 product、PBI、表条件等底层过滤字段；
- 每次列表调用有 pageSize 和最大分页数限制。

### 11.2 Agent 上下文

列表响应即使只有少量工单也可能体积很大。Provider 应：

- 首先返回摘要；
- 用户或 Agent 明确需要时再取详情；
- 长文本、流程历史和附件以引用表示；
- 对账号、人员、内部地址和受限字段进行策略过滤；
- 不把 Cookie、Header、原始请求或认证错误细节放入上下文。

### 11.3 日志与审计

允许记录：

- Instance、Capability、耗时、状态和错误分类；
- 查询范围、页码和返回数量；
- 工单 ID 的受控引用或摘要；
- 身份验证时间和连接健康状态。

禁止记录：

- Cookie 值；
- 密码及其编码结果；
- 完整请求/响应 Header；
- 原始详情响应；
- SSO 跳转票据。

## 十二、错误映射与诊断

| 现象 | 公共错误 | 用户建议 |
|---|---|---|
| DNS/TCP 失败 | `network_unreachable` | 连接公司网络或 VPN |
| 企业证书不受信 | `tls_untrusted` | 安装或更新企业根证书 |
| 代理连接失败 | `proxy_failed` | 检查代理配置 |
| HTTP 200 + 空 body + redirect header | `session_expired` | 静默刷新或重新登录 |
| 身份接口无法确认账号 | `authentication_failed` | 重新登录 |
| 接口返回无权限 | `authorization_denied` | 联系管理员或调整范围 |
| 429 | `rate_limited` | 按 Retry-After 延迟 |
| JSON/schema 与预期不符 | `protocol_changed` | 更新 DTS Provider |
| 桌面端离线 | `execution_target_offline` | 启动绑定桌面端 |

诊断页按 DNS、直连、代理、TLS、SSO、身份和只读 API 分阶段展示，不能只显示一个模糊红点。

## 十三、写能力边界

DTS 前端存在创建、执行、挂起、撤销、归档、删除、批量操作等接口。V1 不注册任何写 Capability，也不允许通过通用 HTTP 调用绕过。

未来启用写操作的前置条件：

- 获得专用测试账号和测试工单；
- 明确每个操作的业务状态机和权限；
- 验证 `cftk` 获取、轮换和重试行为；
- 每项操作定义 effect、审批要求和幂等策略；
- 执行前展示变更预览；
- 执行后回读确认外部状态；
- 支持部分成功和批量失败审计。

在这些条件满足前，`dts.tickets.permissions` 只用于解释权限，不能被视为写操作授权。

## 十四、测试策略

### 14.1 单元测试

- Cookie domain、path、expiry、secure、删除和同名排序；
- 未认证响应与业务成功响应分类；
- DTS DTO schema 校验；
- 列表请求固定字段和 pageSize 上限；
- Mapper 字段白名单和敏感字段过滤；
- 错误映射；
- single-flight 刷新与最多重放一次。

### 14.2 契约测试

在可访问公司网络的受控环境中验证：

- `getUserInfo`；
- `getHomeFilters`；
- `listByVersionAndHead`；
- `getTicket`；
- `getRelationTickets`；
- `getDtsPermit`；
- 非法 JSON、错误 Method、过期 Cookie 和权限不足；
- 直连、代理和系统 CA。

测试报告只保存状态、schema、字段名、数量、摘要和耗时，不保存工单正文与凭据。

### 14.3 桌面认证测试

- 首次打开认证窗口并登录；
- 已有 SSO 时静默恢复；
- 密码错误、密码过期、验证码和 MFA；
- 登录窗口关闭和用户取消；
- HttpOnly Cookie 异步读取；
- 远程窗口无 Tauri IPC 权限；
- 主框架跳向非白名单域时阻止或交给系统浏览器；
- 应用重启后的登录恢复行为。

### 14.4 恢复与稳定性测试

- 1、5、15、30、60 分钟会话观测；
- 多次并发查询只触发一次刷新；
- 刷新成功后读取调用自动恢复；
- 刷新失败后任务进入可恢复状态；
- 桌面端离线与重新上线；
- DNS、代理、TLS 和服务端短时故障；
- 分页大数据量、响应体积和上下文裁剪；
- 短时间连续请求与 429 处理。

### 14.5 不允许在生产数据上执行的测试

- 创建、修改、关闭、挂起、撤销或归档工单；
- 上传/删除附件；
- 批量状态变更；
- 删除过滤器、视图或草稿。

这些测试必须等待专用测试工单和显式授权。

## 十五、实施计划

### 阶段一：通用骨架

- 建立 ConnectorProvider、Instance、Capability 和 Invocation 契约；
- 建立 Registry、Connector Service、错误分类和存储；
- 建立 desktop execution placement。

### 阶段二：DTS 只读数据面

- 实现系统 CA Transport 和标准 CookieJar；
- 实现 DTS Client、contracts、mapper；
- 打通身份、筛选器、列表、详情、关系和权限；
- 增加脱敏契约测试。

### 阶段三：受管 Web 会话

- 实现隔离 WebView2 认证窗口；
- 实现异步 Cookie 提取和 sidecar 安全转交；
- 实现静默刷新与 `needs_user_action`；
- 完成远程窗口 capability 安全测试。

### 阶段四：产品闭环

- Connector Catalog 与 DTS 详情页；
- 连接预检、登录、范围配置和健康诊断；
- Agent 只读工具；
- WorkObject 外部引用和最小快照；
- Web 任务经桌面 Relay 调用。

## 当前实现边界

桌面设备侧已提供 DTS 个人只读连接、受管 SSO、列表/详情/关系/权限读取及连接状态界面。Agent 工具、WorkObject 持久引用、Web 到桌面的 Relay、自动刷新重放和写能力仍属于目标设计；是否已落地以 `backend/device/src/connectors/` 与 `src/features/connectors/` 的当前代码和测试为准。

## 十六、验收标准

- 用户密码只进入官方 SSO 页面，Fouc 不读取或持久化密码；
- 远程认证窗口无 Fouc IPC capability；
- sidecar 使用系统 CA，不关闭 TLS 校验；
- 连接成功必须由身份接口确认；
- 仅注册明确的只读 Capability；
- Agent 无法构造任意 DTS 请求体或执行全局空过滤查询；
- 列表、详情、关系和权限输出均通过 schema 校验与字段裁剪；
- 会话过期会进入 `needs_user_action`；用户重新连接时可复用仍有效的官方 SSO Profile；
- 桌面离线不会将任务误标为完成；
- 日志、数据库和模型上下文中不存在密码、Cookie 和 SSO 票据；
- 外部工单始终保留 DTS 权威来源引用和快照时间。
