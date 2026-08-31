# 00 · ACP 协议、桥与 Agent 纳管技术：从零开始的完整教程

> 本教程是「Agent 工程系列」的第 00 篇（基础篇）。它不假设你读过任何前置材料——
> 只要求你用过命令行、大概知道"进程"是什么。我们会从一根管道讲起，一路讲到
> 一套生产级的 Agent 纳管系统是如何设计、实现、打包、踩坑的。
>
> 学完本篇，你将能够：
> - 看懂 ACP（Agent Client Protocol）的每一类报文，并手写一个最小 Agent；
> - 理解"桥"存在的意义，掌握三类桥的工程形态与各自的坑；
> - 独立设计一套 Agent 发现 → 探测 → 纳管 → 监督的完整链路。

---

## 目录

1. [为什么要"纳管"一个 AI Agent](#第一章为什么要纳管一个-ai-agent)
2. [预备知识：进程、管道与协议](#第二章预备知识进程管道与协议)
3. [ACP 协议详解](#第三章acp-协议详解)
4. [桥：让不会 ACP 的 Agent 说 ACP](#第四章桥让不会-acp-的-agent-说-acp)
5. [Agent 发现与识别](#第五章agent-发现与识别discovery)
6. [探测与能力清单](#第六章探测与能力清单probe--capability-manifest)
7. [会话监督](#第七章会话监督supervision)
8. [安全模型](#第八章安全模型)
9. [工程化与踩坑实录](#第九章工程化与踩坑实录)
10. [业界方案巡礼](#第十章业界方案巡礼)
11. [动手实践路线图](#第十一章动手实践路线图)
- [附录 A：术语表](#附录-a术语表)
- [附录 B：ACP 报文速查表](#附录-bacp-报文速查表)
- [附录 C：常见问题](#附录-c常见问题)
- [附录 D：参考资料](#附录-d参考资料)

---

## 第一章：为什么要"纳管"一个 AI Agent

### 1.1 Coding Agent 的爆发与形态

2024 年以来，命令行优先（CLI-first）的编码 Agent 成批出现：Claude Code、
Codex CLI、OpenCode、Gemini CLI、Qwen Code、Goose、Auggie、Kimi CLI、
CodeBuddy……它们的共同形态是：

- **一个可执行文件**（`claude`、`codex`、`opencode`……），通常通过 npm、
  原生安装器或包管理器安装到用户机器上；
- **终端里人机对话**：你打字，它读代码、改文件、跑命令；
- **自带一套配置与凭据**：API Key、OAuth 登录、模型选择、权限策略。

这个形态对"一个人开一个终端"很好用。但一旦你想做任何更高级的事情——
多 Agent 协作、把 Agent 嵌进自己的工作台、给团队统一管理凭据和审计——
就会撞上一堵墙：**每个 Agent 都是一座孤岛**。

### 1.2 孤岛问题

孤岛体现在三个层面：

| 层面 | 具体表现 |
|---|---|
| 交互 | 每个 Agent 有自己的 TUI/快捷键/输出格式，程序无法统一读取它们的输出 |
| 协议 | 各家输入输出的格式互不兼容，甚至同一家的版本之间也会变 |
| 治理 | 凭据散落各处、权限弹窗各画各的、没有统一的事件流与审计 |

"纳管"（onboard & supervise）要解决的正是这个问题：**让宿主程序
（一个 IDE、一个工作台、一个调度器）像调用一个库函数一样，统一地调用
本机上任意一个编码 Agent**。

### 1.3 纳管的四个环节

一套完整的纳管系统由四个环节组成，本教程的第三到第七章恰好一一对应：

```
┌──────────────────────────────────────────────────────────────┐
│                        宿主（Host）                            │
│                                                              │
│  ① 发现          ② 探测            ③ 托管          ④ 监督   │
│  Discovery  ──▶  Probe      ──▶   Catalog/     ──▶ Session   │
│  "机器上装了      "它真的是          Registry        Supervision│
│   哪些 Agent？"    它自己吗？         "登记在册"      "看护进程" │
│                 "能干什么？"                                   │
└──────────────────────────────────────────────────────────────┘
```

- **发现（Discovery）**：扫描本机，找出"可能是 Agent"的可执行文件；
- **探测（Probe）**：对每个候选做身份验证与能力测试，回答"这真的是
  Claude Code 吗？它支持会话恢复吗？需要登录吗？"；
- **托管（Catalog / Registry）**：把确认过的 Agent 登记为一条结构化记录
  （路径、版本、能力、健康状态），供上层查询；
- **监督（Supervision）**：实际使用时，负责 Agent 子进程的启动、断连恢复、
  空闲回收、优雅关停——像操作系统的 init 进程看护服务一样看护 Agent。

### 1.4 全景图

把四个环节展开，加上协议与桥，就是本教程的完整知识地图：

```
        你的应用 UI（工作台 / IDE）
              │  事件流（订阅）
        ┌─────▼─────┐
        │  宿主核心  │  发现 · 探测 · 目录 · 监督
        └─────┬─────┘
              │  ACP（JSON-RPC over NDJSON / stdio）
     ┌────────┼──────────────┬───────────────┐
     ▼        ▼              ▼               ▼
  原生 ACP   原生 ACP      JS 适配器桥      原生二进制桥
  Agent     Agent         (claude 类)      (codex 类)
  opencode  qwen …        │                │
                          ▼                ▼
                    驱动用户的 CLI    桥自身直连 CLI
                    (原生可执行)     (Rust 可执行文件)
```

---

## 第二章：预备知识：进程、管道与协议

如果你已经熟悉进程、stdin/stdout 和 JSON-RPC，可以快速浏览本章；
"为什么用 stdio"和"NDJSON"两节值得停留。

### 2.1 进程与子进程

操作系统里，每个运行中的程序是一个**进程**。一个进程可以启动另一个进程，
后者称为**子进程**，启动者称为**父进程**。宿主启动 Agent，宿主就是父、
Agent 就是子。三个概念后面会反复用到：

- **退出码（exit code）**：进程结束时返回的一个整数。惯例上 `0` 表示成功，
  非 0 表示失败。子进程"死了"的时候，父进程能读到它的退出码。
- **信号（signal）**：操作系统向进程发送的异步通知。最常见的是
  `SIGTERM`（请求退出，进程可以清理后自行退出）和 `SIGKILL`（立即杀死，
  进程无法拦截）。Windows 上对应 `TerminateProcess`，语义接近 SIGKILL。
- **孤儿进程**：父进程先死、子进程还活着，子进程就成了孤儿。没有专门的
  处理时，孤儿可能一直占着端口或文件，这是后面踩坑章节的主角之一。

### 2.2 标准流：stdin / stdout / stderr

每个进程生来就有三条标准 I/O 流：

| 流 | 方向 | 惯例用途 |
|---|---|---|
| stdin（标准输入） | 写入进程 | 程序读取"用户敲的字"或上游数据 |
| stdout（标准输出） | 从进程读出 | 程序的正常输出 |
| stderr（标准错误） | 从进程读出 | 错误与诊断信息 |

当父进程启动子进程时，它可以**接管子进程的三条流**：往子进程的 stdin
写数据、从它的 stdout/stderr 读数据。这就是**管道（pipe）**——两个进程
之间一根字节管道。

关键推论：**只要 Agent 从 stdin 读、往 stdout 写，宿主就能与它对话，
无论 Agent 是用什么语言写的。** 这是所有本地 Agent 协议的基石。

### 2.3 为什么 Agent 协议偏爱 stdio

让宿主与本地 Agent 通信，理论上有很多选择：HTTP、WebSocket、gRPC、
Unix socket……但主流方案（ACP，以及它借鉴的 LSP）都选了 stdio，原因值得
逐条理解：

1. **零网络暴露**：不开端口，就不存在"别的程序连上来"的攻击面，也不需要
   鉴权握手。协议数据从头到尾没离开过这对父子进程之间的管道。
2. **生命周期天然绑定**：父进程退出时可以带走子进程；管道断开（EOF）本身
   就是一方死亡的可靠信号。HTTP 做不到这一点，需要额外心跳。
3. **无配置**：不需要端口号、地址、TLS 证书。启动即通信。
4. **跨平台、跨语言**：stdin/stdout 是所有操作系统、所有运行时都有的东西。
5. **沙箱友好**：子进程继承父进程可控的环境变量与工作目录，权限边界清晰。

代价是：stdio 只适合**一对一、本地**的通信。如果要把事件转发给浏览器 UI
（多订阅者、跨机器），就需要宿主在中间再做一层（例如 WebSocket 广播）——
这是第七章的内容。

### 2.4 JSON-RPC 2.0 速成

有了字节管道，还需要约定"字节怎么组织成消息"。ACP 选择的是 **JSON-RPC
2.0**——一个极简的远程调用协议，只有三种消息：

**请求（Request）**——想调用对方的一个方法，带 `id` 以便配对响应：

```json
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {...}}
```

**响应（Response）**——对某个请求的应答，`id` 与请求一致。成功带
`result`，失败带 `error`（含 `code`、`message`，可选 `data`）：

```json
{"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": 1, ...}}
{"jsonrpc": "2.0", "id": 2, "error": {"code": -32603, "message": "Internal error"}}
```

**通知（Notification）**——没有 `id` 的单向消息，对方不需要回应。Agent 的
流式输出（消息片段、工具调用进度）都是通知。

标准错误码是理解故障的钥匙：`-32700` 解析错误、`-32600` 无效请求、
`-32601` 方法不存在、`-32602` 参数无效、`-32603` 内部错误。ACP 在此之上
定义了自己的扩展码，最重要的两个：`-32000` `AUTH_REQUIRED`（需要登录）、
`-32001` 会话不存在。

一个容易被忽视的要点：**JSON-RPC 是双向的**。Agent 也可以向宿主发"请求"
（需要宿主回应）——ACP 的权限审批正是这么做的，见 3.5 节。

### 2.5 NDJSON：一行一条消息

管道传的是字节流，没有"消息边界"。把一个大 JSON 写进 stdout，读方可能
一次读到一半（半包），也可能一次读到两条（粘包）。ACP 的解法是
**NDJSON（Newline-Delimited JSON）**：每条消息序列化成一行 JSON，以
`\n` 结尾。读方按行切分，每行独立解析。

```
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}\n
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,...}}\n
{"jsonrpc":"2.0","method":"session/update","params":{...}}\n
```

写方要注意两点：**序列化时不能带换行**（JSON 序列化器默认满足）；**写完
立刻 flush**（很多语言的输出有缓冲区，忘了 flush 对方就"卡住"了）。

### 2.6 从 LSP 到 ACP：协议的家谱

**LSP（Language Server Protocol）** 是编辑器界的先例：VS Code 为了支持
任意语言，把"编辑器 ↔ 语言服务"的通信标准化成 JSON-RPC over stdio，
一夜之间任何编辑器都能接任何语言。**ACP（Agent Client Protocol）** 把
同样的思想搬到 Agent 领域：把"宿主 ↔ 编码 Agent"的通信标准化。由编辑器
Zed 的团队（zed industries）发起，Claude Code、Codex 等官方或社区适配
随之而来。理解了 LSP 为什么成功，就能理解 ACP 的设计取舍：**窄协议、
强约定、把复杂度留给实现而不是协议**。

---

## 第三章：ACP 协议详解

### 3.1 ACP 是什么

ACP（Agent Client Protocol）定义了宿主（client）与编码 Agent（agent）
之间的全部对话：握手、建会话、发任务、收流式输出、请求审批、切换模型、
恢复会话。当前协议版本号为 `1`。官方 SDK 有 TypeScript 实现
（`@agentclientprotocol/sdk`），社区有 Rust 等实现。

一句话概括会话结构：**宿主与 Agent 之间先 `initialize` 握手一次，然后可以
开多个 `session`，每个 session 里 `prompt` 驱动一轮工作，工作过程以
`session/update` 通知流式返回。**

### 3.2 连接建立：initialize

宿主启动 Agent 子进程后，发送的第一条消息必须是 `initialize`：

```json
{
  "jsonrpc": "2.0", "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": { "readTextFile": true, "writeTextFile": true }
    }
  }
}
```

两个要点：

- `clientCapabilities.fs` 声明宿主是否愿意替 Agent 读写文件。若声明为
  false，Agent 涉及文件的操作会转而通过权限请求向宿主申请（见 3.5）。
  这是 ACP 的一个重要安全设计：**文件访问权掌握在宿主手里**。

- Agent 的响应里最关键的是 `agentInfo` 与 `agentCapabilities`：

```json
{
  "jsonrpc": "2.0", "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentInfo": { "name": "claude", "version": "2.1.220" },
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": { "image": true },
      "mcpCapabilities": { "http": true, "sse": false }
    },
    "authMethods": [ { "id": "anthropic", "name": "Login with Anthropic" } ]
  }
}
```

  这份响应就是第六章"能力清单"的原始素材：Agent 自报家门（name/version，
  用于身份校验）、自报能力（能否恢复会话、能否发图、支持哪种 MCP）。

### 3.3 会话模型：session/new 与 resume

握手完成后，宿主用 `session/new` 开一个工作会话：

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "session/new",
  "params": { "cwd": "D:\\projects\\demo", "mcpServers": [] }
}
```

- `cwd` 是这个会话的工作目录——Agent 的所有文件操作都以它为根。
- `mcpServers` 允许宿主为会话注入 MCP 工具服务器（MCP 与 ACP 的关系见
  3.9）。
- 响应返回 `sessionId`，以及 Agent 当前的 `modes`（权限档位）与
  `models`（可用模型）。

会话恢复是纳管体验的关键。ACP 提供两条路：

- **`session/load`**：宿主主动传入 Agent 侧的会话标识（`sessionId` 或
  `cursor`），把 Agent 恢复到历史状态。Agent 若不支持，会在
  `agentCapabilities.loadSession` 里声明为 false。
- **`_meta` 私有通道**：`session/new` 的 params 里允许携带 `_meta` 字段，
  供特定 Agent 传递私有恢复参数。不同 Agent 对"恢复"的实现差异很大，
  这个口子为它们保留了方言空间（第七章会看到真实用例）。

此外部分 Agent 支持 `session/fork`（从某点分叉）与 `session/list`（列出
历史会话），都体现在 `agentCapabilities.sessionCapabilities` 里。

### 3.4 交互：session/prompt 与流式更新

发任务的报文：

```json
{
  "jsonrpc": "2.0", "id": 2,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess-abc",
    "prompt": [
      { "type": "text", "text": "修复 src/api.ts 里的空指针并补测试" },
      { "type": "resource_link", "uri": "file:///D:/projects/demo/src/api.ts", "name": "src/api.ts" }
    ]
  }
}
```

`prompt` 是一个内容块数组，不只是纯文本——可以引用文件资源、附带图片，
这是 Agent 理解"任务上下文"的通道。

接下来 Agent 不停地发 **`session/update` 通知**，每一类 update 提供一类
UI 信息（`update.sessionUpdate` 字段区分）：

| sessionUpdate 类型 | 含义 | 典型 UI 呈现 |
|---|---|---|
| `agent_message_chunk` | 助手回复的一个文本片段 | 流式追加到消息气泡 |
| `agent_thought_chunk` | 思考/计划片段（可选展示） | 可折叠的"思考中" |
| `tool_call` | Agent 发起一次工具调用（id/kind/title/status/content） | 工具卡片（运行中/完成） |
| `plan` | 当前计划与步骤状态 | 待办清单 |
| `available_command_update` | 可用的斜杠命令 | 输入框命令补全 |
| `current_mode_update` | 权限档位变化 | 状态条 |

`tool_call` 值得展开：它有稳定的 `toolCallId`，状态在
`pending → in_progress → in_progress(output) → completed` 间流转，内容
是"日志行"数组。宿主靠 `toolCallId` 把同一个工具的多次更新合并成一张卡片。

**一轮的结束信号**：当 `session/prompt` 的**响应**（注意——是响应，不是
通知）返回时，代表这一轮 prompt 的全部 update 已发完。响应的 result 里
通常带 `stopReason`（end_turn / cancelled / max_tokens / refusal）和
本论用量统计（`usage`：输入/输出 token、费用、时长）。宿主用它来判定
"本轮任务结束"并落库。

中途取消：宿主发送 `session/cancel` 通知（带 `sessionId`），Agent 应停止
当前轮并让 prompt 请求以 cancelled 收尾。

### 3.5 权限：session/request_permission

这是 ACP 最有意思的设计之一：**Agent 反向调用宿主**。当 Agent 要执行
敏感操作（跑 shell 命令、写文件）而策略要求确认时，它向宿主发一个**请求**：

```json
{
  "jsonrpc": "2.0", "id": 100,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess-abc",
    "toolCallId": "call-1",
    "options": [
      { "optionId": "allow_once", "name": "允许一次", "kind": "allow_once" },
      { "optionId": "allow_always", "name": "总是允许", "kind": "allow_always" },
      { "optionId": "reject_once", "name": "拒绝", "kind": "reject_once" }
    ],
    "interactions": [
      {
        "type": "request",
        "call": { "command": ["bash", "-c", "rm -rf node_modules"], "kind": "execute" }
      }
    ]
  }
}
```

宿主弹出审批 UI，用户点选后，宿主**作为 JSON-RPC 响应**回传所选
`optionId`。`kind` 是关键语义：`allow_once`（只这一次）、`allow_always`
（这类操作以后都允许）、`reject_once` / `reject_always`。

工程上有个微妙而重要的缓存规则（源自真实实现的语义约定）：**只有
`allow_*always*` 的裁决才应该被缓存**；`allow_once` 永远不缓存——否则
"允许一次"就悄悄变成了"允许每次"，这是安全事故。第八章会展开。

### 3.6 模式与模型

- `session/modes` 查询权限档位（如 default / acceptEdits / bypassPermissions），
  `session/set_mode` 切换；
- `session/models` 查询模型列表，`session/set_model` 切换。set_model 在
  协议演进中曾以非标准形式存在，调用前应探测支持性。

### 3.7 生命周期与关闭

- **进程级**：Agent 进程退出（exit code + 信号）就是连接的终结。宿主应
  同时监听进程 exit、stdout close、管道 error 多个信号，先到者为准。
- **优雅关停**：宿主先关闭 Agent 的 stdin（EOF），给 Agent 一小段宽限期
  自行收尾；超时则发 SIGTERM；再超时 SIGKILL。三段式见 7.8。

### 3.8 一个完整会话的报文时序

把前面所有报文串成一个真实时间线（宿主 = H，Agent = A）：

```
H→A  initialize (id=1)                          # 握手
A→H  result: agentInfo=claude, loadSession=true # 自报家门
H→A  session/new (id=2, cwd=...)                # 开会话
A→H  result: sessionId=s1, modes, models
H→A  session/prompt (id=3, "修复空指针")          # 发任务
A→H  notify session/update: tool_call(读文件)     # ┐
A→H  notify session/update: tool_call(跑测试)     # │ 流式过程
A→H  notify session/update: agent_message_chunk  # │
A→H  request session/request_permission (id=100) # ┘ 途中请求审批
H→A  result(id=100): allow_once                  # 用户点了"允许一次"
A→H  notify session/update: tool_call 完成
A→H  result(id=3): stopReason=end_turn, usage    # 本轮结束
H→A  session/cancel / session/prompt ...         # 下一轮或取消
     （宿主关闭 Agent 的 stdin）
A    进程退出                                    # 优雅收尾
```

建议把这张图抄在手上——后面写 Agent、写桥、写监督器，全部围绕这条时间线。

### 3.9 ACP、MCP、LSP：一张对比表

三个协议经常被混为一谈，其实各管一段：

| | LSP | MCP | ACP |
|---|---|---|---|
| 连接的两端 | 编辑器 ↔ 语言服务 | 应用 ↔ 工具/数据源 | 宿主 ↔ 编码 Agent |
| 解决什么 | 代码补全/诊断标准化 | 工具调用上下文标准化 | Agent 驱动标准化 |
| 传输 | stdio（JSON-RPC） | stdio / HTTP / SSE | stdio（NDJSON JSON-RPC） |
| 类比 | "电源插座标准" | "USB 接口标准" | "驾驶员与方向盘的标准" |

它们是**组合**而非竞争：一个 ACP Agent 完全可以在会话里使用 MCP 工具
（`session/new` 的 `mcpServers` 参数就是为此准备的）。

---

## 第四章：桥：让不会 ACP 的 Agent 说 ACP

### 4.1 为什么需要桥

协议再好，也要对方肯说。现实分三种情况：

1. **Agent 原生支持 ACP**：它自带 ACP 模式（如 `opencode acp`、
   `qwen --acp`）。宿主直接把它当 ACP 对端即可，**不需要桥**。
2. **Agent 官方/社区提供了适配器**：Agent 本体不懂 ACP，但存在一个翻译
   程序，一边对宿主说 ACP，一边用 Agent 自己的原生接口（SDK、子进程协议）
   驱动它。这个翻译程序就是**桥（bridge）**。典型：Claude Code 官方没有
   ACP 模式，社区（后转官方维护）的 `@agentclientprotocol/claude-agent-acp`
   通过 `claude-agent-sdk` 驱动它。
3. **没有任何适配**：要么等生态，要么自己写桥（4.6 给出骨架）。

### 4.2 桥的解剖：一个双向翻译器

剥开任何一座桥，内部都是四件事：

```
宿主 ◀── ACP/NDJSON ──▶ ┌───────────── 桥 ─────────────┐ ◀── 原生接口 ──▶ Agent
                        │ ① 进程代理：spawn Agent、接管其 stdio   │
                        │ ② 报文翻译：prompt → 原生输入；          │
                        │    原生输出 → session/update           │
                        │ ③ 权限转译：原生确认弹窗 → request_permission │
                        │ ④ 会话映射：原生会话 ID ↔ ACP sessionId   │
                        └────────────────────────────────────┘
```

四个部分里最难的通常是 ③：原生 Agent 的确认机制千奇百怪（CLI 交互提示、
IDE 弹窗、配置文件开关），要把它统一翻译成 ACP 的 options 模型，经常需要
在桥里注入配置、拦截钩子甚至改环境变量。

### 4.3 三类桥的工程形态

**形态一：原生 ACP（无桥）**。宿主直接 spawn Agent 的 ACP 模式。宿主侧
成本为零；需要注意的是不同 Agent 的 ACP 子命令不同（`acp` / `--acp` /
`--output-format acp`），且能力参差，全靠握手响应来探测。

**形态二：JS 适配器桥**。以 `claude-agent-acp` 为例，它是 npm 包，本质是
一段 Node/Bun 程序：对外说 ACP；对内通过 `claude-agent-sdk` 驱动 Claude
Code。这个形态的驱动方式经历了两代演进，恰好是"桥类工程问题"的完整教材：

- **第一代（SDK ≤0.2.x）：内嵌 CLI**。SDK 在包里捆绑一份完整的 Claude
  Code CLI 脚本（`cli.js`），桥把它解压到临时目录，再以 `bun <cli.js>`
  的方式当子进程跑。由此派生一串独特的坑：桥需要 JS 运行时（用户机器
  未必有）；进程树多一层（桥 → SDK → CLI）；把 JS 编译成单文件 exe 后
  "运行时子命令"语义失效（exe 只会运行内嵌脚本）；解压依赖的临时目录
  逻辑还曾因上游发包缺文件而需要打补丁。
- **第二代（SDK ≥0.3）：原生二进制 + 指定可执行**。SDK 改为通过平台
  optional 依赖分发**原生 claude 可执行文件**，同时适配器开放了
  `CLAUDE_CODE_EXECUTABLE` 环境变量——宿主可以直接指定**用户自己安装的**
  claude 来驱动。这让"纳管"语义变得更纯粹：宿主管理的正是用户装的
  那个 Agent（版本、登录、中转配置全随用户），桥只做协议翻译，内嵌
  CLI 与运行时垫片那一整套复杂度就此消失。

  无论哪一代，都要注意：**桥的版本与 Agent 本体存在兼容窗口**。桥内嵌
  或绑定的核心越新/越旧，都可能解析不了用户侧新版配置——选桥版本要以
  "兼容最广的真实用户配置"为准，而不是无脑追新（真实案例：新版桥的
  配置解析器不认新版 CLI 写入的枚举值，反而旧桥与真实配置兼容）。

**形态三：原生二进制桥**。`codex-acp` 是一个 Rust 编译的原生可执行文件，
一边说 ACP，一边驱动 Codex CLI。优点：无运行时依赖、启动快；缺点：体积
大（约 80MB）、平台相关（每个 OS/架构一份）、只能随其发布节奏更新。

### 4.4 桥的获取与分发策略

"用户的机器上怎么有一座桥"有四种主流策略，各有代价：

| 策略 | 安装包体积 | 首次使用 | 离线可用 | 代表 |
|---|---|---|---|---|
| 运行时 `npx`/`bunx` 拉取 | 最小 | 需联网下载（慢、易碎） | 否 | AionUi 早期 |
| managed runtime + 运行时下载 | 小（运行时也现下） | 需联网（下载 node + 包） | 否 | AionCore（npx + 版本锁） |
| 随包分发独立桥 exe | 大（每个桥背一份运行时地板） | 即刻 | 是 | 简单粗暴期 |
| 内嵌进主程序 + 按需下载原生桥 | 小 | JS 桥即刻；原生桥首次联网 | JS 桥是 | 混合策略 |

选型的核心矛盾是**确定性 vs 体积**。运行时拉取把网络抖动、registry 可达
性、缓存损坏引入了 Agent 可用性，因此走这条路的系统都必须配一套自愈机制
（缓存校验、损坏重下、版本锁）。国内环境还要考虑镜像回退（例如官方
registry 失败自动切 npmmirror，并允许用环境变量指定镜像）。

一个常被低估的事实：**JS 运行时编译产物的"地板体积"**。一份 bun 编译的
单文件可执行至少 80MB+，如果每个桥都独立编译，就是 N 份 80MB——把所有
JS 桥内嵌进同一个主程序、只留一份运行时地板，是把体积打下来的关键。

### 4.5 桥的坑清单（前人血泪）

- 子进程运行时解析：桥内部用 `"bun"`/`"node"` 启动子程序时，靠 PATH 查找。
  宿主必须保证正确的那份运行时在子进程 PATH 的最前面，否则可能命中用户
  机器上的任意版本。
- 环境变量卫生：宿主自己的内部变量（端口、token、数据目录）若泄进 Agent
  子进程链，可能触发匪夷所思的行为（见 8.5 的真实案例）。
- 黑窗：Windows 上 GUI 程序 spawn 控制台程序会弹黑窗，必须显式
  `CREATE_NO_WINDOW`。
- 日志洪水：桥与 Agent 的 stderr 汇流，一个 8KB 的环形缓冲是标准的
  "最后 N 行错误"留存手段。
- 版本漂移：桥与 Agent 本体的版本兼容窗口有限，桥版本要用锁文件或包依赖
  显式固定，升级是"产品行为"而不是"自动行为"。

### 4.6 动手：一个最小桥的骨架

假设有个虚构 Agent `foo`，只支持"一问一答"（stdin 一行问题，stdout 一行
答案）。给它包一层 ACP（TypeScript 伪代码，跑在 Bun/Node 上）：

```ts
// foo-acp-bridge.ts —— 最小可用桥（省略错误处理）
import { spawn } from "node:child_process";

const write = (msg: unknown) => process.stdout.write(JSON.stringify(msg) + "\n");

process.stdin.setEncoding("utf8");
let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    handle(JSON.parse(buf.slice(0, i)));   // 每行一条 JSON-RPC
    buf = buf.slice(i + 1);
  }
});

function handle(req: any) {
  switch (req.method) {
    case "initialize":
      write({ jsonrpc: "2.0", id: req.id, result: {
        protocolVersion: 1,
        agentInfo: { name: "foo", version: "1.0" },
        agentCapabilities: { loadSession: false },
      }});
      break;

    case "session/new":
      write({ jsonrpc: "2.0", id: req.id, result: { sessionId: "s1", modes: [], models: [] }});
      break;

    case "session/prompt": {
      const question = req.params.prompt.find((b: any) => b.type === "text")?.text ?? "";
      const child = spawn("foo", [], { stdio: ["pipe", "pipe", "inherit"] });
      child.stdin.write(question + "\n");
      child.stdout.on("data", (out: Buffer) => {
        // ④ 报文翻译：原生输出 → ACP 流式通知
        write({ jsonrpc: "2.0", method: "session/update", params: {
          sessionId: req.params.sessionId,
          update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: out.toString() } },
        }});
      });
      child.stdout.on("end", () => {
        // 本轮结束：回应 prompt 请求本身
        write({ jsonrpc: "2.0", id: req.id, result: { stopReason: "end_turn" }});
      });
      break;
    }
  }
}
```

40 行就有一个能被任何 ACP 宿主驱动的"Agent"。把它反过来（作为宿主去
连接别的桥）同样只需要解析这些报文——这正是 ACP 生态的杠杆所在。

---

## 第五章：Agent 发现与识别（Discovery）

### 5.1 发现的三条路

1. **PATH 扫描**：把目录里声明的每个 Agent 的命令名（`claude`、`codex`…）
   拿去 PATH 里查。
2. **已知安装位置**：枚举各平台惯例目录（`~/.local/bin`、`%APPDATA%\npm`、
   `~/.bun/bin`、`~/.cargo/bin`、scoop shims……），看里面有没有同名可执行。
3. **用户手动添加**：以上两条都没有时，让用户直接指路径。手动添加的记录
   不应被自动发现"标记失踪"而误删。

### 5.2 命令可用性检测：批量、防抖、跨平台

朴素做法是每个命令名起一个进程去 `which`——一次发现要起几十个进程，慢且
闪烁。正确姿势：

- **POSIX**：一次 `/bin/sh -c 'command -v claude && echo claude; command -v codex && echo codex; …'`
  全查完，解析输出集合。
- **Windows**：`where <cmd>` 并行查；失败再回退 PowerShell 的
  `Get-Command`（因为 `where` 找不到 `.ps1`/别名类入口）。

检测到"存在"后还要**解析出首个命中的绝对路径**（`where` 的第一行、
`command -v` 的输出），并确认文件真的存在——PATH 里常有指向已卸载程序的
死条目。

### 5.3 PATH 增广：裸 PATH 不够

用户通过 nvm/volta/fnm/scoop/npm 全局装的工具，常常不在宿主进程继承的
PATH 里（宿主可能由 GUI 启动，环境与登录 shell 不同）。成熟做法是维护
一份"工具目录增广表"，把常见版本管理器与包管理器的 bin 目录合并进检测
用的 PATH。同时可以加载**登录 shell 的完整环境**（macOS `dscl` 读用户
shell 后 `bash -l -c env`；Linux `getent`；Windows 则以增广表为主），
让用户自定义的 API Key 环境变量也能传给 Agent。

### 5.4 安全过滤

拼进 shell 的命令名必须过**白名单**（如 `^[a-zA-Z0-9_.-]+$`），杜绝
`foo; rm -rf` 这类注入。任何来自外部的字符串（路径、参数）都不应直接
拼进命令行。

### 5.5 从候选到登记

PATH 命中只产生**候选（candidate）**，不是正式记录。登记时需要一个稳定
的唯一 ID——常用"provider + 可执行路径哈希"（同一 Agent 装了两份路径不同，
就是两条记录，各自独立探测）。注意：**候选 ≠ 身份确认**。`which agent`
可能撞上同名无关程序（真实例：Cursor 的 CLI 命令名是 `agent`）。身份
确认发生在下一章的探测阶段。

---

## 第六章：探测与能力清单（Probe & Capability Manifest）

### 6.1 为什么要探测

发现的产出只是"PATH 上有个叫 claude 的东西"。它可能：是同名无关程序、
是坏了的旧版本、需要登录、协议版本不兼容。探测（probe）要一次性回答
四个问题：**你是谁？什么版本？还能用吗？能干什么？**

### 6.2 探测流水线

一次完整探测是分阶段、有独立超时预算的：

```
解析路径 ──▶ 版本探测 ──▶ ACP 握手 ──▶ (可选) session/new 试开 ──▶ 状态落库
 (where)      (<cmd> --version)  (initialize)     开一个会话即关      + 能力清单
              预算 5s           预算 15s          （桥放宽到 90s）
```

- **版本探测**失败 ≠ Agent 坏了（有些 CLI 不支持 `--version`），只影响
  展示，不阻断后续。
- **ACP 握手**是身份与协议的双重验证：能完成 initialize 且 `agentInfo.name`
  与目录声明相符（子串匹配，如 "claude" 匹配 "Claude Code"），才算身份
  确认。
- **session/new 试开**进一步验证"登录/凭据"是否就绪——很多 Agent 握手
  成功但开不了会话（未登录）。试开会话立即关闭，避免留下垃圾进程。
- 各阶段超时分开设置。桥类 Agent 首启慢（解压、下载），握手预算要放宽。

### 6.3 失败分类学：错误转状态

探测的失败要翻译成**用户能行动的状态**，这是纳管产品体验的核心。一套
实践中的分类：

| 状态 | 含义 | 典型成因 | 用户该做什么 |
|---|---|---|---|
| `unchecked` | 刚发现，还没探测 | —— | 等自动探测或点"检测" |
| `ready` | 身份确认、协议通、凭据可用 | —— | 直接用 |
| `needs_auth` | 程序在，但凭据未就绪 | 未登录 / 订阅过期 / token 失效 | 去原厂登录或续费 |
| `needs_runtime` | 缺桥所需的运行时 | 无 node/bun | 安装运行时 |
| `incompatible` | 认识它，但协议版本对不上 | Agent 过旧/过新 | 升级 Agent 或宿主 |
| `unhealthy` | 探测超时/启动失败/输出异常 | 半安装、杀软拦截、配置损坏 | 看诊断信息修复 |
| `disabled` | 用户手动停用 | —— | 需要时再启用 |
| `missing` | 登记过但文件没了 | 被卸载 | 重新安装 |

判断依据是错误信号的结构化抽取：进程退出码、stderr 关键模式（如
`command not found` 指向 runtime 问题、配置解析错误指向 incompatible）、
JSON-RPC 错误码（`-32000` AUTH_REQUIRED 直接映射 needs_auth）。注意
`needs_auth` 的语义要诚实：**token 存在但被服务端拒绝（如订阅过期）也
落在这里**——它表达的是"凭据当前不可用"，而不是狭义的"没登录"。

### 6.4 能力清单：从握手证据生成

能力清单（Capability Manifest）是 Agent 登记记录里"能干什么"的部分，
**必须从真实握手响应派生，禁止静态假设**——目录里写的只是期望，实际
能力以 Agent 自己说的为准。典型字段：

- 适配层级：如 L0 仅存在 / L1 可会话 / L2 可流式 / L3 可恢复会话；
- 会话能力：loadSession / resume / fork / list；
- 输入能力：image、embeddedContext；
- MCP 能力：http / sse；
- 指纹：能力的哈希，变更时提示"该 Agent 行为发生了变化"。

### 6.5 节流与并发

探测要花钱（起进程、占 CPU），需要节流：同一安装 **5 分钟内不重复探测**，
手动触发绕过节流。批量探测（如启动时全量刷新）要有并发上限（如 8），避免
一次性拉起十几个重型 CLI 把机器打满。飞行中的探测要防重入（同一目标同时
只探测一次）。

---

## 第七章：会话监督（Supervision)

### 7.1 监督者模式

真正使用 Agent 时，宿主要做的事远不止"spawn 一个进程"。子进程会崩、会
挂起、会被杀软误杀；用户会合上电脑、杀掉应用；Agent 会卡死不吐字。宿主
需要一个**会话监督器（supervisor）**——它对每个活跃会话负责：

- 启动/重建 Agent 连接；
- 把 Agent 的 ACP 事件流转发给 UI（带会话/轮次标识）；
- 断连时判定"崩溃"还是"静默失联"并执行不同恢复策略；
- 空闲回收；
- 应用退出时优雅关停全部子进程。

### 7.2 会话状态机

给每个受管会话一个显式状态机，而不是散布的布尔标志。一套实践中的七态：

```
idle ──start──▶ starting ──握手+建会话──▶ active ⇄ prompting
                   │                        │    │
                   ▼                        ▼    ▼
                 error ◀──── 各种失败 ──── error / resuming
                                              ▲
                   suspended ──resume──▶ resuming ──┘
```

- `idle`：逻辑会话存在，没有活着的进程；
- `starting`：进程已 spawn，握手进行中；
- `active`：就绪，等待任务；
- `prompting`：一轮 prompt 进行中；
- `suspended`：进程没了但状态已保存，可恢复；
- `resuming`：恢复中；
- `error`：不可恢复失败，诊断信息随状态保存。

**所有状态转移必须查表**（显式的合法转移表），非法转移直接暴露 bug。
这比"改状态时凭感觉"的写法在排障时省一个数量级的时间。

### 7.3 断连的两种世界

进程断连时，先看**最后是否处于 prompting**：

- **任务中崩溃（crash）**：立刻进入自动恢复流程——重启进程、恢复会话、
  把未完成的轮次重放（或标记失败并询问用户）。要点是快速、透明；
- **静默失联（进程死了但没人发现，或宿主重启后遗留）**：应用重启时做一次
  扫描，把所有"没正常结束"的会话统一置为 `suspended`（保留 Agent 侧
  会话 ID），用户点进去时再恢复。原则：**宁慢勿丢**——宁可让用户手动
  恢复，也不要把可恢复的会话误标为失败。

同理，**未收尾的轮次（run）**在宿主重启后统一标记为"失败（原因：宿主
中断）"，绝不静默标成功——审计记录的第一原则。

### 7.4 原生会话恢复的方言

恢复 Agent 会话的通道有三个层次，按 Agent 能力选用：

1. `session/load`（标准）：Agent 声明 `loadSession: true` 才可用；
2. `_meta` 私有通道：某些 Agent 的恢复参数要走 `session/new` 的
   `_meta` 字段（例如 Claude 系的会话恢复就属于这一类）；
3. 不支持恢复：降级为"新建会话"，并给用户一个"上下文已重置"的提示。

探测产出的能力清单在这里直接决定恢复策略——这就是 6.4 强调"能力必须
来自真实握手"的原因。

### 7.5 空闲回收与自动唤醒

每个 Agent 进程是几十到几百 MB 的内存。监督器应周期巡检（如每 30 秒），
把超过空闲阈值（如 10 分钟）且状态为 `active`（无任务进行中）的会话挂起
（优雅关停 + 记录恢复点）。用户再次使用时透明恢复——理想情况下用户感知
不到回收发生过。注意 prompting 中的会话绝不回收。

### 7.6 事件流：从子进程到 UI

Agent 事件（消息片段、工具卡片、审批请求）要经历三跳：
`Agent 子进程 → 监督器 → 事件日志（append-only） → WS 广播 → UI`。

- 每条事件带 `sessionId` + `runId`（轮次 ID），UI 按 run 分组渲染；
- **事件日志先落库再广播**：UI 重连/应用重启后可以回放完整历史；
- 广播通道要带鉴权（见 8.2），且断线自动重连（指数退避，封顶）；
- 服务器未就绪期间的事件先缓冲，就绪后冲放——避免"启动头几秒事件丢失"。

### 7.7 审批链闭环

把 3.5 的协议语义落成产品，需要四个环节严丝合缝：

1. **请求进来**：`request_permission` 到达 → 生成待审批卡片（冻结该轮
   Agent 的执行）；
2. **UI 呈现**：卡片上显示操作详情（命令、路径、diff 预览）与选项；
3. **裁决回传**：用户点选 → 宿主回 JSON-RPC 响应 → Agent 继续；
4. **缓存策略**：`allow_always` 裁决按"操作指纹"（kind + 标题 + 命令/路径）
   存入 LRU 缓存，下次同指纹直接放行不再打扰；`allow_once` **永不缓存**。

一个验证审批链是否正确的金标准测试：同一敏感操作连问两次——第一次答
"允许一次"，第二次必须再次弹出（证明 allow_once 没被缓存）；再答"总是
允许"，第三次不再弹出（证明 allow_always 生效）。

### 7.8 优雅关停三段式

关停一个 Agent 子进程的标准动作序列：

```
1. 关闭子进程 stdin（EOF）─────── 大多数 Agent 会自行收尾退出
2. 等待宽限期（1～3 秒）
3. SIGTERM ──────────────────── 要求退出
4. 再等待 → SIGKILL ──────────── 强制
```

应用退出路径上要**先串行关停全部会话再退出进程**，否则会留下一地孤儿
Agent 进程。Windows 上注意 kill 的对象是进程句柄而非 PID（PID 会被复用）。

---

## 第八章：安全模型

### 8.1 进程边界即安全边界

本地 stdio 架构的安全基线：**宿主与 Agent 之间没有网络面**。真正的风险
面在四个地方：宿主自己的服务端口、文件访问代理、审批语义、以及供应链。

### 8.2 宿主-后端鉴权

宿主（或宿主的后端）若提供 HTTP/WS API 给 UI，必须：绑定 `127.0.0.1`
而非 `0.0.0.0`；启动时生成**随机 token**（不落盘、不进日志）；所有请求
带 `Bearer`；WebSocket 用**首帧认证**（连接后第一条消息带 token，通过
前不投递任何事件）而不是 query string（URL 会进各种日志）。

### 8.3 权限三策略与最小惊讶

审批选项的语义（allow_once / allow_always / reject_*）必须与缓存行为
严格一致（见 7.7）。另外要提供"全自动档"（YOLO/bypass）时把它做成显式
的、每个 Agent 用原生术语命名的档位（如 Claude 的 `bypassPermissions`、
Codex 的 `fullAccess`），并在 UI 常驻显示当前档位——权限状态不可见是最
容易酿成事故的产品设计缺陷。

### 8.4 文件系统守卫

Agent 通过 `fs/read_text_file`、`fs/write_text_file` 请求宿主读写文件时，
宿主必须校验路径：解析为绝对路径后**必须落在该会话的 cwd 之内**（拒绝
`../` 穿越、符号链接逃逸），否则拒绝。这是"文件访问权掌握在宿主手里"
这一 ACP 设计的兑现处。

### 8.5 环境变量卫生

传给 Agent 子进程的环境要"净手"：

- **删除**：宿主自身的启动器变量（端口/token/数据目录——泄入子进程链会
  诱发诡异行为，如子进程误启服务器抢端口）、`NODE_OPTIONS`/`NODE_DEBUG`
  （会改变 CLI 行为）、`npm_*` 生命周期变量、以及"从某 Agent 内部启动"
  的嵌套检测变量；
- **保留/注入**：用户登录 shell 里的自定义变量（API Key 在这）、增广后的
  PATH、以及桥运行时所在目录（PATH 前置）。

一个真实案例：宿主把 `FOUC_BACKEND_PORT` 泄给了被当作 `bun` 启动的运行时
垫片，垫片误以为自己该当服务器，起来就撞端口，形成"每 30 秒崩一次"的
幽灵循环——环境变量卫生不是洁癖，是正确性。

### 8.6 供应链：桥的完整性

按需下载桥二进制时：只从官方 registry 获取**带 dist.integrity（sha512）**
的包；下载后先校验哈希再落盘；写入用"临时文件 + 原子改名"；版本在目录
里显式固定；允许用户用环境变量指定镜像源，但镜像只换地址不换校验逻辑。

---

## 第九章：工程化与踩坑实录

本章把一套"纳管系统"从代码变成可分发产品的过程中，最疼的几类坑摊开讲。
每一条都来自真实事故，而非理论推演。

### 9.1 桌面架构：壳 + 边车（sidecar）

典型结构：**原生壳（Tauri）负责窗口与进程看护，业务逻辑全部放在一个
TS 编译的单文件后端（sidecar）里**。分工原则——壳只做三件事：起后端、
健康监视、退出时收尾；一切业务（发现/探测/会话/桥）都在后端。安装后
用户机器上是两个 exe：`app.exe`（壳）与 `app-backend.exe`（后端）。
单一安装包，双击即用。

### 9.2 编译型 JS 运行时的三重坑

把 Bun/Node 程序编译成单文件 exe 后，它的行为与"解释运行"有几个差异，
每一个都值得刻在纪念碑上：

1. **exe 不再是 CLI**。`backend.exe x --bun pkg@ver` 不会执行"bun x"，
   只会带着这些参数运行内嵌脚本。想在子进程里"用 bun 跑一个 js 文件"，
   正确姿势是 `exe <file.js>`（首参为文件时编译运行时会执行该文件），
   或者干脆造一个指向自身的 `bun.exe` 硬链接放在 PATH 前面。
2. **顶层 await 会延迟其后的顶层 const**。模块顶部的 `await`（比如做
   argv 分发）会让打包器把其后的常量拆到延迟求值的段里；后面被调用的
   函数读到 `undefined`。教训：**环境常量要么放到顶层 await 之前，要么
   在使用处读取**。一个真实后果：端口常量变 undefined，
   `Bun.serve({port: undefined})` 落到默认端口 3000，与本机 dev server
   开战，后端每半分钟被杀一次。
3. **默认值也是行为**。任何"未指定时的默认"（端口、路径、名字）都要当
   成产品行为来审查——它会和你用户的机器上的其它东西相撞。

### 9.3 进程树的健康监视：三则教训

- **健康检查别走代理**。系统代理（Clash 等）会拦截发往 127.0.0.1 的
  HTTP 请求。壳的健康检查若用了带系统代理的 HTTP 客户端，会把健康后端
  判死。本地回环请求必须显式 no-proxy。
- **判死之前先容忍、先补刀**。单次超时不算死（Agent 启动会短暂阻塞事件
  循环），连续多次失败才判死；判死后必须先 kill 旧进程再重启——旧进程
  可能只是"慢"而非"死"，留着它，新进程起来就端口冲突，进入幽灵循环。
- **随机端口要排除保留区**。用"bind :0 拿空闲端口"时，要排除开发常用
  端口（3000/8080/自己的 dev 端口），否则开发者一边跑 dev server 一边
  测安装包时，两者会互相残杀——这种"只在开发机上爆发"的 bug 最能消磨
  心智。

### 9.4 日志归因

多个子进程（后端、桥、运行时垫片）的 stderr 汇入同一个日志文件时，每行
日志必须带 **pid 前缀**。没有 pid，你永远分不清某行 "Fatal error" 是主
进程死了还是某个垫片在抱怨。另一个易漏点：打包器不一定刷新"裸 exe 旁边
的 sidecar 副本"——构建脚本要主动同步，否则你一直在测试陈旧二进制而
浑然不觉。

### 9.5 国内网络现实

registry.npmjs.org 直连可能被重置。按需下载桥要内置**镜像回退**（官方源
失败自动切 npmmirror），并允许环境变量覆盖镜像地址；校验逻辑与源解耦
（integrity 来自元数据，换镜像不降安全性）。

### 9.6 体积策略回顾

单文件 JS 可执行有 ~80MB 的运行时地板。铁律：**整个产品只允许存在一份
运行时地板**。JS 桥内嵌进主程序、原生桥按需下载、能直接用用户已装 CLI
的（原生 ACP）绝不另带一份。

---

## 第十章：业界方案巡礼

### 10.1 Zed 与 ACP 本体

ACP 由 Zed 团队发起（agentclientprotocol.com），动机很"Zed"：编辑器要
接所有 Agent，那就定一个所有人都能实现的窄协议。官方 TS SDK
（`@agentclientprotocol/sdk`）质量高，协议文档即实现指南。Zed 编辑器本身
是 ACP 的第一个大规模宿主。

### 10.2 AionUi 1.x（TS 时代）

Tauri 壳 + TypeScript 编排层，纳管十余个 CLI Agent。桥经 `bun x`/
`npx` 运行时拉取，为此建设了一整套自愈：bunx 缓存损坏检测与白名单清理、
npx 版本锁、PATH 增广、登录 shell 环境加载。它的价值在于把"纳管一个
CLI Agent 需要处理的全部边角"第一次完整地摆在了桌面上——本教程第五章、
第六章的很多细节都能在它的源码里找到原型。

### 10.3 AionUi 2.x / AionCore（Rust 时代）

2.x 把后端重写为 Rust（AionCore），桌面端转 Electron + 内置 aioncore
二进制。桥策略演进为 **managed Node runtime（从 nodejs.org 下载）+
`npx -y` 固定版本**，配合 registry 版本锁与缓存修复迁移。这是一条"瘦
安装包 + 运行时下载"路线的完整工程化样本：它证明这条路可行，也展示
了它的全部代价（下载子系统、锁文件、修复逻辑、首次使用的网络依赖）。

### 10.4 方案对比与启示

| | AionUi 1.x | AionCore / 2.x | 混合策略（第 4.4 末行） |
|---|---|---|---|
| 后端 | TS | Rust | TS 编译单文件 |
| 桥 | bunx/npx 现场拉 | managed node + npx 锁 | JS 桥内嵌 + 原生桥按需下载 |
| 安装包 | 小 | 中（Electron 地板） | 小 |
| 离线可用 | 否 | 否 | JS 桥是 / 原生桥首次需网 |
| 复杂度去向 | 自愈逻辑 | 下载/锁子系统 | 分发策略本身 |

没有银弹，只有明码标价的取舍。选择哪一列，取决于你的用户网络环境、
更新节奏与安装包体积的敏感度。

---

## 第十一章：动手实践路线图

### 11.1 实验一：手写最小 ACP Agent（约 100 行）

照着 3.8 的时序图与 4.6 的骨架，写一个"回声 Agent"：收到 prompt 后分
三个 chunk 流式回显文本，最后以 `stopReason: "end_turn"` 收尾。验收
标准：任何 ACP 宿主（或你自己写的宿主客户端）能与你对话一轮完整会话。
进阶：实现 `session/request_permission`——prompt 里包含 "危险" 一词时
先请求审批。

### 11.2 实验二：写一个探测器（约 150 行）

输入：一组目录声明（命令名 + 期望身份）。流程：PATH 检测 → 解析路径 →
`--version` → spawn + initialize 握手 → 校验 `agentInfo.name` → 输出
状态与能力清单（6.3/6.4 的全部字段）。验收：对本机真实安装的 2-3 个
Agent 产出正确的 ready / needs_auth 分类。

### 11.3 实验三：给一个非 ACP Agent 写桥（进阶）

选一个只有 CLI 交互的 Agent（或你自己的程序），按 4.2 的四件事实现翻译
层。难点在权限转译：如果原 Agent 没有确认机制，考虑用"白名单命令表 +
其余一律 request_permission"的默认安全策略。

### 11.4 进阶阅读

- ACP 协议仓库与文档（agentclientprotocol.com）——权威报文定义；
- `@agentclientprotocol/claude-agent-acp`、`@zed-industries/codex-acp`
  ——两个生产级桥的完整实现；
- LSP 规范——协议分层与能力协商的鼻祖；
- MCP 规范——理解 ACP 会话里 `mcpServers` 参数的另一端。

---

## 附录 A：术语表

| 术语 | 释义 |
|---|---|
| ACP | Agent Client Protocol，宿主与编码 Agent 间的 JSON-RPC/stdio 协议 |
| Agent / 宿主 | 被驱动的一侧 / 驱动的一侧（client） |
| 桥（bridge） | 把非 ACP 的 Agent 翻译成 ACP 的适配器进程 |
| NDJSON | 每行一个 JSON 的流式编码，ACP 的传输格式 |
| 纳管（onboard） | 发现→探测→登记→监督的完整生命周期管理 |
| 发现（discovery） | 在本机定位候选 Agent 可执行文件 |
| 探测（probe） | 验证候选的身份/版本/协议/凭据并产出能力清单 |
| 能力清单（manifest） | 从握手证据派生的 Agent 能力结构化描述 |
| 会话（session） | 一次持续的工作上下文，有 cwd 与 sessionId |
| 轮次（run/prompt） | 一次 session/prompt 及其全部流式更新 |
| 审批（permission） | Agent 反向请求宿主确认敏感操作 |
| 状态机 | 会话生命周期的显式状态与合法转移集合 |
| 挂起（suspend）/ 恢复（resume） | 保进程上下文关停 / 重建进程并接回会话 |
| 孤儿进程 | 父进程死亡后仍存活的子进程 |
| sidecar | 与主程序同装、由主程序看护的辅助进程 |
| 运行时地板 | 编译型 JS 可执行中固定存在的运行时体积（~80MB） |

## 附录 B：ACP 报文速查表

```
宿主 → Agent
  initialize                     握手（协议版本 + 宿主能力）
  session/new {cwd, mcpServers}  新会话
  session/load {sessionId|cursor} 恢复会话（能力探测后使用）
  session/prompt {prompt[]}      发任务（内容块数组）
  session/cancel {sessionId}     取消当前轮
  session/set_mode / set_model   切档位/模型
  fs/read_text_file | write_text_file   文件读写代理（宿主侧实现）
  (响应) id=<审批请求id> → {outcome}    审批裁决回传

Agent → 宿主
  (响应) initialize → {agentInfo, agentCapabilities, authMethods}
  (响应) session/new → {sessionId, modes, models}
  (响应) session/prompt → {stopReason, usage}
  notify session/update {update.sessionUpdate: agent_message_chunk |
      agent_thought_chunk | tool_call | plan | available_command_update |
      current_mode_update, ...}
  request session/request_permission {options[], interactions[]}
  (响应) fs/read_text_file 等
```

## 附录 C：常见问题

**Q：ACP 和 MCP 到底什么关系，我该学哪个？**
方向不同：ACP 管"宿主怎么驱动 Agent"，MCP 管"Agent 怎么接工具"。做
工作台/IDE 集成学 ACP；给 Agent 加工具学 MCP。两者经常一起用。

**Q：为什么不直接用 HTTP API 驱动各家的 CLI？**
因为各家没有统一（甚至没有）HTTP API；CLI 的稳定公共接口就是 stdio。
ACP 在 stdio 上统一了报文，这是成本最低的最大公约数。

**Q：桥是官方的还是第三方的？**
都有。claude 系桥最初是社区（后由 @agentclientprotocol 组织维护），
codex 桥由 Zed 官方维护。选桥看维护者、更新节奏与版本兼容窗口。

**Q：Agent 提示需要登录，但我明明登录了？**
区分两种情况：真没登录；或凭据存在但被服务端拒绝（订阅过期、token
失效、第三方中转余额不足）。探测的 needs_auth 覆盖两者——先去原厂
CLI 里跑一次确认，再回宿主点健康检查。

**Q：为什么我的 Agent 隔一会儿就"断线重连"？**
大概率是空闲回收（7.5）或宿主健康监视误判（9.3）。前者是正常设计，
透明恢复即可；后者检查：健康检查是否走了代理、判死阈值是否太敏感、
是否与其它进程抢端口。

## 附录 D：参考资料

- ACP 官方：`agentclientprotocol.com`（协议规范与 TS SDK 仓库）
- JSON-RPC 2.0 规范：`jsonrpc.org/specification`
- LSP 规范（设计思想源头）：microsoft.github.io/language-server-protocol
- MCP 规范：`modelcontextprotocol.io`
- Zed 编辑器（ACP 首个大规模宿主）：`zed.dev`
- 生产级桥参考实现：`@agentclientprotocol/claude-agent-acp`、
  `@zed-industries/codex-acp`（npm/GitHub）
- 开源纳管实现参考：AionUi（iOfficeAI/AionUi、AionCore）

---

> **下一篇预告**：01 篇将走进"多 Agent 协作与任务编排"——当一个会话不够用，
> 如何把多个纳管后的 Agent 组合成流水线与团队。
