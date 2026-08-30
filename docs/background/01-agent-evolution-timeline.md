# AI Agent 历史演进：从对话助手到可治理的数字执行者

> 时间范围：以 2024-10 至 2026-08 为主，基准日 2026-08-08。

## 一、先定义：什么变化才算 Agent 演进

“Agent” 不是单一产品类型。一个系统从聊天助手向 Agent 演进，通常依次获得以下能力：

1. **目标理解**：接收结果导向而非逐步命令；
2. **计划与状态**：把目标拆成步骤，维护任务状态；
3. **工具行动**：读取文件、调用 API、执行命令或操作界面；
4. **环境反馈**：根据测试、网页、日志等真实结果迭代；
5. **记忆与持久化**：跨轮次、跨会话或跨机器继续工作；
6. **委派与协作**：调用子 Agent 或与外部 Agent 交换任务；
7. **权限与责任边界**：按身份、动作风险、数据域进行授权和审批；
8. **评测与治理**：可追踪、回放、度量、审计和持续改进。

过去一年最关键的历史变化，是第 3—8 项从各家私有实现逐渐变成公开协议、通用运行时和企业控制面。

## 二、演进的五个阶段

### 阶段 0：对话与补全（2022—2023）

这一阶段以 ChatGPT 式问答和 GitHub Copilot 式补全为代表。AI 生成内容，但大多数动作由人复制、粘贴和执行。上下文主要来自当前对话、打开文件或手动提供的片段。核心瓶颈是：AI 与真实工作系统隔离，没有可靠的反馈闭环。

### 阶段 1：Tool-using Agent 与早期多 Agent 框架（2023—2024 上半年）

函数调用、ReAct 循环、RAG、AutoGen、LangGraph、CrewAI 等让模型开始“思考—调用工具—观察—继续”。多 Agent 主要是应用内部的编排模式：开发者事先定义研究员、写作者、审阅者等角色，由一个框架在同一信任域内调度。

这个阶段证明了可行性，也暴露三类问题：

- 每个工具都要为每个 Agent 框架单独集成；
- Demo 很容易，长任务的恢复、状态、评测和权限很难；
- 多 Agent 常增加 token、延迟和协调失败，却未必增加正确率。

### 阶段 2：计算机使用、Coding Agent 与 MCP（2024 下半年）

2024-10，Anthropic 发布计算机使用能力；同月 OpenAI 开源实验性 [Swarm](https://github.com/openai/swarm)，用极简的 Agent 与 handoff 抽象探索多 Agent 编排。Swarm 明确不是生产框架，后来由 Agents SDK 取代。

2024-11-25，Anthropic 开源 [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)，试图把 AI 到工具/数据的连接从 N×M 私有适配，变成通用的 host-client-server 协议。这一事件是过去一年 Agent 生态最重要的基础设施节点之一。

同时，Coding Agent 从“在 IDE 里给建议”转向在终端或沙箱里自主搜索代码、编辑文件、执行命令、运行测试。代码任务的优势在于结果可通过编译、测试、lint、Diff 和 Git 进行部分验证，因此它成为 Agent 最早规模化的专业场景。

### 阶段 3：生产级 Agent SDK、A2A 与后台委托（2025）

2025 年是 Agent 从功能展示转向平台化的一年。

#### 2025-02：Claude Code 把终端变成 Agent 工作面

Anthropic 在 2025-02 发布 Claude Code。其后逐步形成 CLAUDE.md、MCP、Skills、Hooks、Subagents、Agent Teams、CI/headless 等扩展体系。其重要性不只在模型能力，而是证明“CLI + 文件系统 + Shell + Git + 可扩展工具”可以成为通用 Agent Harness。

#### 2025-03：OpenAI Agents SDK 取代 Swarm 的实验定位

OpenAI 发布 Responses API 和 [Agents SDK](https://openai.com/index/new-tools-for-building-agents/)，加入工具、handoff、guardrails、tracing 等生产抽象，并明确它是 Swarm 的生产级演进。这标志着“多 Agent”从几个角色互聊，转向带状态、可观测、可评测的工程系统。

#### 2025-04：A2A 与 ADK 同日出现

Google 在 2025-04-09 发布 [Agent2Agent Protocol](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) 和开源 [Agent Development Kit](https://developers.googleblog.com/agent-development-kit-easy-to-build-multi-agent-applications/)。MCP 主要连接 Agent 与工具，A2A 主要连接相互独立、可能由不同厂商实现的 Agent。二者形成后来最常见的互补叙事。

同月 OpenAI 发布开源 Codex CLI，使模型厂商直接参与本地 Coding Agent Harness 竞争。

#### 2025-05 至 06：企业平台把 Agent 变成可委派的工作单元

GitHub Copilot coding agent 开始承接 issue、在云环境修改仓库并提交 PR；Microsoft 在 Build 2025 发布 Copilot Studio 多 Agent 编排；ServiceNow 推出 AI Agent Orchestrator/Studio；各家从“创建一个机器人”转向“让多个专业 Agent 在业务流程中协作”。

2025-06-23，Google 将 A2A 贡献给 Linux Foundation，成立独立项目。Linux Foundation 的公告称其当时已有超过 100 家企业支持，说明互操作不再只是 Google Cloud 的私有接口。

#### 2025-07 至 10：Coding Agent 客户端、模型与 IDE 解耦

2025 年中后期出现几条并行路线：

- ByteDance 开源 Trae Agent，并持续发展 TRAE IDE/SOLO；
- 阿里系 Qoder 以 Repo Wiki、Quest、Spec-driven 和任务工作台强调大型仓库上下文；
- Zed 在 2025-08 发布 [Agent Client Protocol（ACP）](https://zed.dev/blog/bring-your-own-agent-to-zed)，让 Gemini CLI、Claude Code、Codex 等 Agent 可以接入同一个编辑器；
- Google 在 2025-09 发布 [Agent Payments Protocol（AP2）](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)，开始为 Agent 的高风险商业动作定义可验证授权；
- Microsoft 在 2025-10 推出 [Microsoft Agent Framework](https://devblogs.microsoft.com/foundry/introducing-microsoft-agent-framework-the-open-source-engine-for-agentic-ai-apps/)，把 AutoGen 的多 Agent 抽象与 Semantic Kernel 的企业状态、遥测和中间件路线合并。

#### 2025-12：协议进入中立基金会治理

Linux Foundation 成立 [Agentic AI Foundation（AAIF）](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)，首批项目包括 Anthropic 的 MCP、Block 的 goose 和 OpenAI 的 AGENTS.md。这里的历史意义是：

- MCP 从单一模型厂商发起的协议转向基金会治理；
- AGENTS.md 代表仓库级 Agent 指令也开始标准化；
- Agent 生态的竞争焦点从“谁拥有协议”转向“谁拥有最佳实现、分发、治理和开发者体验”。

### 阶段 4：Agent 控制台、长期运行与跨应用执行（2026 至今）

2026 年的产品重心出现明显变化。

#### 从单会话转向并行工作组合

Claude Code 文档把并行工作细分为 subagents、agent view、agent teams、worktrees 和批量任务；Codex/ChatGPT 桌面端把项目、聊天、worktree、后台任务、技能和插件放进同一控制面；Qoder Quest、TRAE SOLO/Work、OpenChamber 也都强调任务板、多任务、Diff 和远程继续。

这表明 UI 的基本单元正从“聊天消息”变成“有状态的工作项”。未来开发者管理的不是一个补全框，而是一组处于 Running、Waiting、Review、Done 状态的 Agent 任务。

#### MCP 从同步工具调用向更完整运行时扩展

MCP 的 2025-11-25 规范加入更完整的 OAuth/企业身份扩展、URL 模式 elicitation、sampling with tools，以及实验性 durable tasks。到 2026 年，MCP 不再只等于“工具 JSON schema”，开始触及异步任务、Agentic server 和企业授权，但这些扩展的客户端支持仍不完全一致。

#### 企业开始建设 Agent 身份和控制平面

ServiceNow 的 Agent Fabric、Salesforce 的多 Agent 编排、Microsoft Entra Agent ID、NIST 的 AI Agent Standards Initiative，以及 OWASP 的 Agentic Applications Top 10，都说明企业问题已经从“能不能调用”转为：

- 这个 Agent 是谁创建、谁负责？
- 它代表哪个用户或服务身份？
- 能访问哪些数据、在什么条件下执行哪些动作？
- 它委派给另一个 Agent 时，权限和责任如何传递？
- 出错时能否定位、停止、回滚和追责？

## 三、关键时间线

| 时间 | 事件 | 长期意义 |
|---|---|---|
| 2024-10 | Anthropic computer use；OpenAI Swarm 实验项目 | Agent 获得 GUI 行动与轻量多 Agent 编排样例 |
| 2024-11-25 | MCP 开源 | 工具与数据接入开始协议化 |
| 2025-02 | Claude Code 发布 | CLI Agent 成为主流研发交互形态 |
| 2025-03 | OpenAI Responses API / Agents SDK | Agent 工具、handoff、guardrail、trace 产品化 |
| 2025-04-09 | Google A2A 与 ADK | Agent 间互操作与多 Agent SDK 同时进入产业视野 |
| 2025-04 | Codex CLI 开源 | 模型厂商直接竞争本地 Agent Harness |
| 2025-05 | GitHub coding agent、Copilot Studio 多 Agent | 后台 PR 委托与企业多 Agent 编排进入平台层 |
| 2025-06-23 | A2A 进入 Linux Foundation | 跨厂商 Agent 协议获得中立治理 |
| 2025-08 | Zed ACP | Coding Agent 与编辑器客户端开始解耦 |
| 2025-09 | Google AP2 | Agent 商业动作开始引入可验证授权语义 |
| 2025-10 | Microsoft Agent Framework | 研究型多 Agent 与企业 SDK 路线合并 |
| 2025-11 | MCP 周年规范 | 异步任务、企业授权、Agentic server 能力增强 |
| 2025-12 | Linux Foundation AAIF | MCP、AGENTS.md、goose 进入共同治理生态 |
| 2026 H1 | 多家推出 Agent 控制台、后台任务、worktree、多 Agent | 从单 Agent 能力竞争转向人机协同操作系统竞争 |
| 2026 H1—H2 | NIST/OWASP/身份平台强化 Agent 安全标准 | 身份、最小权限、审计成为生产部署前提 |

## 四、历史主线：从 “生成” 到 “闭环” 再到 “组织”

可以把整个演进浓缩为三次跃迁：

### 跃迁一：生成内容 → 操作环境

有工具调用、Shell、浏览器和计算机使用后，模型输出不再停留在文字，而会改变外部世界。价值提高，错误成本也同步提高。

### 跃迁二：一次操作 → 持久闭环

有测试、状态、checkpoint、后台运行、记忆、重试和人工审批后，Agent 才能承担几十分钟到数天的任务。这里的核心不是更长的提示词，而是 durable execution。

### 跃迁三：一个 Agent → Agent 组织

有子 Agent、A2A、任务板、Mesh 和 Agent 身份后，系统开始类似一个数字组织：角色分工、委派、共享制品、升级路径、权限边界和绩效度量都成为架构对象。

## 五、容易误读的三点

### 1. 多 Agent 不天然优于单 Agent

如果任务无法自然分割、共享上下文很重、结果缺少自动验证，多 Agent 往往只是把一次不确定推理变成多次不确定推理，并额外增加协调成本。优先使用单 Agent + 工具 + 明确检查点；只有在并行探索、上下文隔离或专业权限隔离确有收益时再拆分。

### 2. 开放协议不等于开源、免费或安全

MCP/A2A 规定消息如何交换，但不保证服务器代码可信、工具结果正确、权限合理，也不替代采购、身份、密钥、网络和审计控制。

### 3. 自治程度不是成熟度的唯一指标

企业真正需要的是“在给定风险下可控地完成目标”。一个每步都可解释、关键动作需审批、失败可恢复的半自治系统，通常比一个全自动但不可审计的系统更成熟。

## 六、阶段性判断

截至 2026-08，Agent 生态仍相当于“早期云原生”：协议和项目很多、能力更新快、实现差异大、生产最佳实践正在形成。已经可以确定的方向是协议化、可组合、后台化、身份化、可观测；仍未确定的是协议最终收敛程度、跨 Agent 授权语义、长期记忆质量、复杂任务的经济性，以及多 Agent 在多数业务上的净收益。

