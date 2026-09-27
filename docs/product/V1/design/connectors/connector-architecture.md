# Fouc Connector 整体架构设计

## 一、文档目的

本文定义 Fouc Connector 的整体架构、核心对象、生命周期、认证与执行边界，并作为首个 Connector Provider（DTS）及后续 Figma、飞书、数据库、研发平台等连接器的共同设计约束。

本文中的 Connector 不是一个转发所有外部系统的“万能连接器”。Fouc 的基本关系是：

```text
一个外部平台
    ↓
一个 ConnectorProvider
    ↓
零到多个 ConnectorInstance
```

例如 DTS、Figma、飞书分别拥有独立 Provider；一个用户可以建立多个 Figma 或数据库 Instance。通用框架只负责纳管这些 Provider 和 Instance，不取代每个平台自己的协议、认证与领域语义。

## 二、目标与非目标

### 2.1 目标

- 以统一方式管理连接、断开、重新认证、健康检查和诊断；
- 让 Work Room、Agent、Automation 和 Project 通过稳定接口调用外部能力；
- 将具体平台的认证、API、Cookie、Token 和错误封装在对应 Provider 内；
- 区分读取、写入和破坏性操作，并统一执行策略、审批和审计；
- 支持连接器运行在桌面端、云端或客户网络 Relay 等不同位置；
- 凭据不进入模型上下文，不以明文写入 Fouc 普通数据库；
- 允许不同平台共享少量稳定的领域映射，同时保留 Provider 特有能力；
- 首版结构足以承载 DTS，后续新增 Provider 时无需修改上层工作对象与工作流。

### 2.2 非目标

- 不把所有外部系统压缩成一个通用 CRUD API；
- 不让系统根据输入内容隐式猜测应调用哪个外部平台；
- 不在 V1 建设第三方动态插件市场和跨进程插件沙箱；
- 不复制外部系统的完整数据作为第二事实源；
- 不用 MCP 代替 Connector 生命周期、凭据、策略和审计；
- 不允许 Agent 传入任意 URL、Header 或请求体绕过 Provider 的能力契约。

## 三、核心原则

### 3.1 一平台一 Provider，多连接实例

`ConnectorProvider` 描述一种平台的接入实现，如 DTS、Figma、飞书。`ConnectorInstance` 表示用户或团队实际建立的一条连接，例如“我的 DTS”“产品团队 Figma”或“客户 A PostgreSQL”。

Provider 与外部平台一一对应是默认原则；只有同一平台的部署形态、认证协议或能力模型确实不同，且共享实现会造成错误耦合时，才拆分 Provider，例如 GitHub Cloud 与某个不兼容版本的 GitHub Enterprise Server。

### 3.2 通用控制面，独立数据适配器

通用层负责连接器生命周期、凭据引用、执行位置、策略、审批、健康与审计。每个 Provider Adapter 直接面对自己的外部平台：

```text
┌────────────────────────────── Fouc Domain ──────────────────────────────┐
│ WorkObject · Project · Context · Agent · Automation                    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                         Connector Service API
                 list / connect / invoke / diagnose / disconnect
                                   │
┌────────────────────── Connector Control Plane ──────────────────────────┐
│ Provider Registry · Instance Manager · Credential Broker               │
│ Capability Catalog · Policy / Approval · Health / Audit                │
│ Execution Placement · Invocation Record · Error Classification         │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                  按 instance.providerId 取得对应 Adapter
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
┌──────▼─────────┐          ┌──────▼──────────┐         ┌──────▼──────────┐
│ DTS Connector │          │ Figma Connector │         │ Feishu Connector│
│ Auth / Client │          │ OAuth / Client  │         │ OAuth / Client │
│ Session/Mapper│          │ Token / Mapper  │         │ Token / Mapper │
└──────┬─────────┘          └──────┬──────────┘         └──────┬──────────┘
       │                           │                           │
      DTS                        Figma                        飞书
```

Registry 的分发仅解决“这个 Instance 由哪个 Adapter 执行”，不是在多个平台间进行业务路由。调用者必须明确指定 `connectorInstanceId` 和 `capabilityId`。

### 3.3 Capability 属于 Provider

能力由具体 Provider 声明并实现，例如：

```text
DTS
├── dts.tickets.list
├── dts.tickets.get
├── dts.tickets.relations
└── dts.tickets.permissions

Figma
├── figma.files.search
├── figma.files.get
├── figma.nodes.get
└── figma.comments.list
```

Fouc 不先调用一个抽象的 `WorkItem API` 再由 Router 决定走 DTS 或 Jira。若上层需要跨平台展示工单，可以把各 Provider 的输出映射成最小公共领域对象，但该映射不能抹掉 Provider 特有字段和能力。

### 3.4 权威来源与最小快照

外部系统继续拥有业务事实。Fouc 保存：

- 外部对象引用、来源 Instance 与稳定 ID；
- 为工作流和证据所需的最小字段快照；
- 快照时间、内容摘要和访问结果；
- 调用、授权、审批与失败记录。

Fouc 不长期镜像完整工单库、文档库或消息历史。

## 四、核心对象模型

### 4.1 `ConnectorProviderDefinition`

Provider 的静态清单，由代码注册，不存放用户凭据。

```ts
interface ConnectorProviderDefinition {
  id: string
  name: string
  description: string
  authMethods: ConnectorAuthMethod[]
  placements: ExecutionPlacement[]
  capabilities: ConnectorCapabilityDefinition[]
  configurationSchema: unknown
}
```

它描述 Provider 能做什么、需要何种认证、可以在哪里执行以及配置结构，不代表已经建立连接。

### 4.2 `ConnectorInstance`

用户或团队实际建立的一条连接。

```ts
interface ConnectorInstance {
  id: string
  providerId: string
  name: string
  ownerType: 'user' | 'workspace'
  ownerId: string
  desiredState: 'enabled' | 'disabled'
  authState: 'unconfigured' | 'connecting' | 'valid' | 'needs_user_action'
  healthState: 'unknown' | 'healthy' | 'degraded' | 'unreachable'
  executionState: 'online' | 'offline'
  executionTargetType: 'desktop_sidecar' | 'cloud' | 'relay'
  executionTargetId: string | null
  config: Record<string, unknown>
  identity: ConnectedIdentity | null
  connectedAt: number | null
  lastHeartbeatAt: number | null
  lastHeartbeatDurationMs: number | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  createdAt: number
  updatedAt: number
}
```

`config` 只能保存非敏感配置，如服务地址、默认视图、项目范围和分页上限。密码、Token、Cookie 和私钥只能由凭据引用指向安全存储，或仅存在于运行时内存。认证、健康、期望启停与执行目标是相互独立的状态轴，禁止用单个 `status` 混合表达。

### 4.3 `ConnectedIdentity`

连接成功后由外部系统确认的身份快照：

```ts
interface ConnectedIdentity {
  externalId: string
  displayName: string | null
  account: string | null
  tenantId: string | null
  verifiedAt: number
}
```

不能仅凭“登录接口返回 200”判断连接成功；Provider 必须调用身份接口或等价能力，确认当前外部身份。

### 4.4 `ConnectorCapabilityDefinition`

```ts
interface ConnectorCapabilityDefinition {
  id: string
  name: string
  effect: 'read' | 'write' | 'destructive'
  inputSchema: unknown
  outputSchema: unknown
  requiredScopes: string[]
  approval: 'never' | 'policy' | 'always'
  idempotent: boolean
}
```

Capability 是 Agent 和工作流可见的最小调用单元。输入必须经过 schema 校验；Provider 不暴露任意 HTTP 透传能力。

### 4.5 `ConnectorInvocation`

一次能力调用的审计对象，记录：

- Instance、Provider 和 Capability；
- 发起用户、AgentRun、Automation 或系统任务；
- 输入摘要与敏感字段脱敏结果；
- 策略决策和审批引用；
- 实际执行位置与身份；
- 开始、结束、取消、超时和重试；
- 结果摘要、外部对象引用与错误分类。

原始响应默认不进入日志；大响应先裁剪、映射，再交给 Agent。

### 4.6 `ConnectorAdapter`

Provider 的运行时实现遵循统一窄接口：

```ts
interface ConnectorAdapter {
  beginConnect(context: ConnectContext): Promise<ConnectStep>
  continueConnect(
    interactionId: string,
    result: AuthInteractionResult,
    context: ConnectContext,
  ): Promise<ConnectStep>
  diagnose(context: DiagnoseContext): Promise<ConnectorDiagnosis>
  invoke<I, O>(
    capabilityId: string,
    input: I,
    context: InvocationContext,
  ): Promise<O>
  disconnect(context: DisconnectContext): Promise<void>
}

type ConnectStep =
  | { status: 'connected'; identity: ConnectedIdentity }
  | { status: 'needs_user_action'; interaction: AuthInteraction }
  | { status: 'failed'; error: ConnectorError }

type AuthInteraction =
  | { kind: 'open_system_browser'; url: string; callback: string }
  | { kind: 'open_managed_web_session'; url: string; windowProfile: string }
  | { kind: 'collect_secret'; fields: SecretFieldDefinition[] }
  | { kind: 'show_device_code'; verificationUrl: string; userCode: string }

interface ConnectorProvider {
  definition: ConnectorProviderDefinition
  createAdapter(
    instance: ConnectorInstance,
    context: ConnectorRuntimeContext,
  ): ConnectorAdapter
}
```

通用层不接触 Provider 的 Cookie 名称、OAuth 端点、数据库方言或业务字段。

连接过程刻意建模为可继续的多步状态机，而不是一个长期阻塞的 `connect()`。Provider 负责判断下一步需要何种认证交互；Connector Service 负责调用系统浏览器、Tauri 受管 WebView 或安全凭据表单，并把结果交回原 Provider。这样认证 UI 不进入 Provider 业务代码，OAuth、MFA、设备码和内部 Web SSO 也不需要共用一套假设。

## 五、认证模型

认证方式是 Provider 声明的策略，不写死为 OAuth：

```ts
type ConnectorAuthMethod =
  | { kind: 'oauth_system_browser'; pkce: true }
  | { kind: 'managed_web_session' }
  | { kind: 'api_key' }
  | { kind: 'username_password' }
  | { kind: 'device_code' }
  | { kind: 'service_account' }
  | { kind: 'client_certificate' }
```

### 5.1 系统浏览器 OAuth

用于 Figma、飞书、GitHub 等支持 OAuth Authorization Code + PKCE 的平台：

```text
Fouc 生成 state / verifier
    → 系统浏览器登录授权
    → fouc://callback 或 loopback callback
    → 后端校验 state 并换取 token
    → Token 进入系统安全存储
```

系统浏览器是标准 OAuth 的默认选择，避免应用内 WebView 被平台禁止，也复用用户已有登录与密码管理器。

### 5.2 受管 Web 会话

用于没有 OAuth、只能依赖网页登录和 Cookie 的内部或旧系统，如 DTS：

- Tauri 创建隔离的远程 WebView；
- 用户只在官方页面输入账号、密码、验证码或 MFA；
- 远程窗口不获得任何 Fouc IPC capability；
- Tauri 原生层读取登录成功后的 HttpOnly/Secure Cookie；
- Cookie 直接转交本地 sidecar，不经过普通前端状态；
- sidecar 只在内存 CookieJar 中使用短期会话；
- 会话失效后先静默刷新，确需交互时再要求用户重新登录。

### 5.3 直接凭据

API Key、数据库密码、客户端证书等通过 Fouc 表单收集，但必须保存到系统安全存储。普通数据库只保存 `credentialRef`。Provider 使用凭据时通过 Credential Broker 临时取用，不把明文写入日志或 Agent 上下文。

### 5.4 认证状态机

```text
disconnected
    ↓ connect
connecting ──────────────→ error
    ↓
needs_user_action
    ↓ 用户完成登录/授权
verifying
    ↓ 身份确认成功
connected
    ↓ 会话临近失效或请求被拒绝
refreshing ──────────────→ connected
    ↓ 无法静默恢复
needs_user_action
```

同一 Instance 的登录和刷新必须 single-flight，避免多个并发调用同时弹窗或重复刷新 Token。

## 六、执行位置与网络边界

### 6.1 `ExecutionPlacement`

```ts
type ExecutionPlacement =
  | 'desktop'
  | 'cloud'
  | 'desktop_relay'
  | 'customer_relay'
```

- `desktop`：在当前用户桌面 sidecar 执行，如 DTS、本地数据库、本地文件；
- `cloud`：在 Fouc 云端执行，如团队级 SaaS 连接；
- `desktop_relay`：Web 任务转发到某台在线桌面；
- `customer_relay`：在客户网络内的受管 Relay 执行。

Instance 必须绑定明确的 placement 和 execution target。控制面不能因为云端不可达就自动把凭据复制到另一个执行位置。

### 6.2 桌面与 Web 协作

内网 Connector 可以由 Fouc Web 展示和发起，但实际调用路由到在线桌面或 Relay。用户界面必须显示执行位置和可用性，例如：

```text
DTS · 通过“办公电脑”连接
桌面端离线时不可用
```

团队成员不能默认共享个人 Cookie 会话。共享能力必须来自团队级 Instance、服务身份或明确委派。

## 七、调用链与治理

一次调用按以下顺序执行：

```text
调用方指定 Instance + Capability
    ↓
读取 Instance 与 ProviderDefinition
    ↓
检查执行目标在线状态
    ↓
校验输入 Schema 和数据范围
    ↓
检查 Capability effect、策略和审批
    ↓
取得对应 Provider Adapter
    ↓
确保认证可用，必要时刷新
    ↓
执行 Provider 调用
    ↓
校验外部响应并映射输出
    ↓
记录调用证据与外部对象引用
```

### 7.1 副作用分级

- `read`：无外部状态变更，可按工作区策略自动执行；
- `write`：创建评论、更新字段、发送消息等，默认需要策略判断；
- `destructive`：删除、关闭、归档、撤销和批量状态变更，默认必须显式审批。

Provider 声明 effect，通用控制面执行策略。Provider 不得把写操作伪装成读取能力。

### 7.2 重试与幂等

- 只有声明为幂等的能力才可自动重试；
- 网络失败与认证失败分别处理；
- 认证刷新后最多自动重放一次；
- 429、Retry-After、超时与服务端错误遵循 Provider 策略；
- 写操作需要 Provider 提供幂等键或执行后回读确认。

### 7.3 错误分类

公共错误至少包括：

```text
network_unreachable
proxy_failed
tls_untrusted
authentication_required
authentication_failed
authorization_denied
session_expired
rate_limited
invalid_input
protocol_changed
remote_not_found
remote_conflict
remote_error
execution_target_offline
cancelled
timeout
```

Provider 将平台私有错误转换为公共分类，同时保留脱敏诊断信息。

## 八、数据模型与领域映射

### 8.1 不建立万能业务 API

Connector 调用结果首先是 Provider 定义的类型。Fouc 可以为跨系统场景定义少量公共引用：

```ts
interface ExternalObjectRef {
  connectorInstanceId: string
  providerId: string
  objectType: string
  externalId: string
  url: string | null
}
```

对于确实存在稳定公共语义的对象，可以提供最小映射，例如 `ExternalWorkItem`、`ExternalDocumentRef`、`ExternalPersonRef`，但 Provider 结果仍保留扩展字段或原对象引用。

### 8.2 映射位置

```text
Provider 原始响应
    ↓ Provider contract 校验
Provider DTO
    ↓ Provider mapper
Fouc 最小领域对象 / Context Material
```

领域映射发生在对应 Provider 内，不由一个中央 Router 猜测数据含义。

### 8.3 上下文最小化

- 列表默认只返回概要字段；
- 详情按需加载；
- 大字段、附件和历史记录使用引用；
- 个人信息、Token、内部链接和受限字段进入模型前脱敏；
- 缓存设置 TTL、来源、摘要和访问身份，不能冒充最新事实。

## 九、存储与安全边界

### 9.1 建议持久化对象

V1 可增加：

- `connector_instance`：Instance 配置、归属、状态和执行位置；
- `connector_identity`：已验证身份摘要；
- `connector_grant`：允许的能力、范围和审批策略；
- `connector_invocation`：调用审计、结果摘要和错误；
- `connector_snapshot`：必要的外部对象最小快照。

Provider Definition 和 Capability Definition 由代码注册。Secret、Cookie、Token 和私钥不进入 SQLite。

### 9.2 Credential Broker

Credential Broker 负责：

- 以 `credentialRef` 访问 OS Vault 或企业 Secret Store；
- 只把凭据交给指定 Provider、Instance 和执行位置；
- 区分个人凭据、团队凭据和短期会话；
- 支持吊销、轮换和删除；
- 避免凭据进入日志、Trace、错误消息和模型上下文。

### 9.3 远程认证窗口

受管 Web 会话窗口必须使用独立 label，不能匹配主窗口 capability。禁止为远程域配置通用 IPC 权限；限制主导航域名；关闭 DevTools；不得把 sidecar Bearer Token 或其他 Connector 凭据注入页面。

## 十、Provider 注册与代码组织

V1 采用仓库内静态注册，不提前建设动态插件加载：

```text
backend/device/src/connectors/
├── core/
│   ├── provider.ts
│   ├── instance.ts
│   ├── capability.ts
│   ├── invocation.ts
│   ├── credentials.ts
│   ├── policy.ts
│   └── errors.ts
├── runtime/
│   ├── registry.ts
│   ├── service.ts
│   ├── supervisor.ts
│   └── health.ts
└── providers/
    ├── dts/
    ├── figma/
    └── feishu/
```

前后端共享的 DTO 和 API 契约放在 `shared/`。Tauri 只承担系统浏览器、远程 WebView、OS Vault 和 Cookie Store 等系统能力桥，不承载 Provider 业务逻辑。

当至少三种认证和业务形态显著不同的 Provider 稳定后，再根据真实共性固化外部插件 SPI。届时 Provider 可以由插件提供，但仍必须通过同一控制面注册 Definition、创建 Adapter，并接受策略和审计。

## 十一、MCP 与 Connector 的关系

MCP 可以成为某个 Provider Adapter 的底层协议，也可以由 Connector Capability 包装后提供给 Agent，但两者职责不同：

- MCP 解决工具发现和调用协议；
- Connector 解决实例、身份、凭据、范围、健康、审批、审计和生命周期；
- 外部 MCP Server 不能绕过 Connector Policy；
- 一个 MCP Server 可以支撑一个 Provider，也可以只提供 Provider 的部分能力。

## 十二、用户操作旅程

通用连接旅程为：

1. 用户从 Connector Catalog 选择具体 Provider；
2. 查看能力、副作用、数据范围、认证方式和执行位置；
3. 点击连接，系统进行网络和运行时预检；
4. 按 Provider AuthMethod 进入系统浏览器、受管 Web 会话或凭据表单；
5. Provider 验证外部身份；
6. 用户配置 Instance 名称、能力范围、默认项目/视图和 Agent 使用权限；
7. Fouc 创建 Instance，并显示身份、执行目标和健康状态；
8. Agent 或工作流通过 Instance 调用已授权 Capability；
9. 会话失效时先自动刷新，无法恢复时进入 `needs_user_action`；
10. 用户断开后清理会话和凭据，保留必要审计。

用户界面不应只显示“已连接/未连接”，还应显示：身份、执行位置、授权范围、最近健康检查、最近调用和需要用户处理的状态。

## 十三、V1 实施顺序

1. 落地 Provider、Instance、Capability、Invocation 和错误契约；
2. 实现 Registry、Connector Service 和健康状态；
3. 实现桌面执行位置与受管 Web 会话系统桥；
4. 以 DTS Provider 打通只读闭环；
5. 将 DTS 工单映射为最小 External WorkItem/Context Material；
6. 接入策略、审批和调用审计；
7. 选择 OAuth 型 Provider 验证系统浏览器认证；
8. 选择团队级 Provider 验证云端或 Relay 执行；
9. 基于三个真实 Provider 收敛插件 SPI。

## 十四、验收标准

- 同一 Provider 可创建多个相互隔离的 Instance；
- 上层调用必须明确 Instance 和 Capability，不存在隐式平台选择；
- 新增 Provider 不修改 Work Room 与工作流核心状态机；
- 连接、认证、健康、权限不足和远端错误可明确区分；
- Secret 不进入普通数据库、日志和 Agent 上下文；
- 桌面、云端和 Relay 连接具有明确执行位置；
- 读取与有副作用能力在定义、策略和 UI 中均可区分；
- 外部对象保留权威来源引用，缓存不会冒充实时事实；
- 连接器不可用时任务进入可恢复状态，不被误标为完成；
- 所有外部写操作具有审批、幂等保护和审计记录。
