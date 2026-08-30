# 未来 3—12 个月展望：Agent 会发生什么，哪些判断仍需保留

> 预测起点：2026-08-08。以下不是已承诺的产品路线图，而是基于协议、官方产品演进、治理动作和用户行为的情景判断。每项标注信心等级。

## 一、总判断

未来一年不会突然出现一个可靠替代所有员工的“超级 Agent”。更可能发生的是五条基础设施曲线同时成熟：

1. Coding Agent 的任务时长和并发数继续增长；
2. Agent 从单一 App 进入浏览器、桌面、移动端和云后台；
3. MCP/A2A/ACP/AG-UI 等协议按层分工并被平台吸收；
4. Agent identity、最小权限、审计和安全评测成为企业采购门槛；
5. 人类工作从“操作应用”转为“维护目标、约束、队列和验收”。

最值得注意的不是某个模型多得了几分，而是 Agent 是否能在现实环境中长期、安全、经济地完成有副作用的任务。

## 二、未来 0—3 个月：控制台和可靠性竞争加速

## 2.1 多 Agent 管理会成为 Coding 工具标配

**信心：高。**

Claude Code 已区分 subagents、agent view、agent teams、worktrees；Codex 已把 subagent、worktree、长期任务和桌面控制面结合；Qoder、TRAE、OpenChamber、Cursor 也在强化并行任务板。

短期产品竞争会集中在：

- 哪些 Agent 正运行、等待批准或失败；
- 一键接管/steer/stop；
- worktree/分支隔离与合并；
- 子任务依赖和预算；
- 只看摘要即可判断是否值得深入；
- 手机/远程查看而不丢上下文。

“开多个终端窗口”会迅速变成低端体验；控制台是否降低监督成本将比能否 spawn Agent 更重要。

## 2.2 Skills、Rules、AGENTS.md 进一步互认

**信心：高。**

Claude Code、Codex、OpenCode、Gemini CLI、GitHub Copilot 等已支持 Skills 或仓库指令，OpenCode甚至主动发现 `.claude/skills` 与 `.agents/skills`。AAIF 同时接纳 MCP 和 AGENTS.md，说明可移植的 Agent 配置正在形成事实标准。

预计产品会增加：

- 从其他 Agent 导入会话/规则/Skills；
- 一个 Skill 包含 scripts、MCP、UI、evals 和 policy metadata；
- Skill marketplace 和组织私有目录；
- Skill 来源、签名、权限和版本提示。

同时，Skill 会成为新的供应链攻击面。企业要像审查 GitHub Action、浏览器扩展一样审查 Skill，而不是把 Markdown 当作无害文档。

## 2.3 当前模型比较的半衰期继续缩短

**信心：高。**

模型发布频率和 Harness 更新使“某工具绝对最好”的结论快速过期。模型路由、按任务选择、BYOK 和订阅内多模型将更普遍。真正稳定的差异会转到数据接入、任务恢复、工具回路、安全和工作台。

## 2.4 企业会收紧任意 MCP 安装

**信心：高。**

MCP 已从开发者实验进入企业基础设施，风险也更明确：confused deputy、prompt injection、SSRF、token 泄漏、恶意 server/工具描述。OWASP、NIST、NSA 与各大身份平台都在强化 Agent 安全。

近期企业大概率会采用：允许目录、集中代理、远程托管、用户身份透传、短期 token、工具级 policy、DLP 和完整审计。开放协议仍会保留，但“个人随意连接任何 server”的阶段会在受管环境结束。

## 三、未来 3—6 个月：协议从“能连”走向“能运营”

## 3.1 MCP 的 durable task 和 Agentic server 支持扩大

**信心：中高。**

MCP 2025-11-25 规范已把 tasks 标为实验性，并加入 sampling with tools。预计更多客户端会实现异步任务、断线恢复、工具搜索和动态加载，以避免一次性把数百个工具塞进上下文。

但不会所有客户端同时完整实现。企业仍需维护 capability matrix，并为不支持的新特性准备普通 job API/webhook 降级。

## 3.2 A2A 从 Demo 转入有限生产

**信心：中高。**

[Linux Foundation 2026-04 公告](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)称 A2A 支持组织已超过 150 家，并进入 Google、Microsoft、AWS 等平台。未来半年最可能出现的是同一企业/合作伙伴生态内的受控 A2A，而非互联网上任意 Agent 自由交易。

先落地的形态会是：

- SaaS 平台之间的专业 Agent 委派；
- Agent Card 在企业目录注册，而非公共网络盲发现；
- 任务和 Artifact schema 由行业/业务联盟约定；
- 跨 Agent 消息经过网关、policy 和审计；
- 认证仍依赖 OAuth/OIDC、云 IAM 和合同关系。

## 3.3 Agent identity 成为独立产品层

**信心：高。**

[NIST AI Agent Standards Initiative](https://www.nist.gov/news-events/news/2026/02/announcing-ai-agent-standards-initiative-interoperable-and-secure)已经推动 Agent 身份和授权标准；Microsoft Entra 等身份平台开始提供专用 Agent identity。预计 IAM 厂商会增加：

- Agent service principal/owner/lifecycle；
- 代表用户行动的 delegation token；
- purpose-bound、短期、可衰减权限；
- Agent 到 Agent 委派链；
- 自动发现影子 Agent；
- 权限复审和孤儿 Agent 回收。

身份层有望成为 Agent Mesh 最先标准化、最有预算的一部分。

## 3.4 Agent 评测从模型分数转向任务经济学

**信心：高。**

企业会更关注每个成功结果的全成本，而不是单次 benchmark：模型费用、墙钟时间、人类主动时间、评审、CI、失败副作用都要计入。相同 Agent 可能让熟悉旧仓库的专家变慢，却让陌生仓库 onboarding 或长尾维护明显加速。

[METR 2025 研究](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)发现特定资深开源开发者样本使用早期 2025 工具变慢；[METR 2026 研究页](https://metr.org/research/)又报告 Agent 能处理更长的软件任务。两者并不矛盾：能力边界在增长，但组织净收益仍依赖任务分配和评审。

## 四、未来 6—12 个月：Agent 工作流重塑组织接口

## 4.1 Coding Agent 成为 Issue/CI/Review 的常驻参与者

**信心：高。**

Agent 将从开发者主动打开的工具，变成仓库事件触发的参与者：

- 新 issue 自动澄清、复现和估算；
- PR 自动生成有证据的专项评审；
- CI 失败自动调查并提出最小修复；
- 依赖/安全公告自动映射到受影响代码；
- 文档与代码漂移自动发现；
- 夜间跑机械迁移，白天由人评审。

这会提高代码/PR 产量，也可能让评审成为新瓶颈。领先团队会投资小 Diff、强测试、自动风险分级和 CODEOWNERS 路由，而不是只追求 Agent 吞吐量。

## 4.2 IDE 逐渐从编辑器变成 Agent 运营台

**信心：高。**

代码仍需编辑，但主界面会增加目标列表、并行 Agent、Artifact、浏览器/应用预览、审批、成本和部署。ACP 使 Agent 与编辑器解耦，意味着未来可能像选择语言服务器一样选择 Coding Agent；但商业平台仍会用云任务、模型额度和企业治理形成黏性。

## 4.3 “组织知识”从文档库变成执行资产

**信心：中高。**

Repo Wiki、Knowledge Cards、Memory、Skills、AGENTS.md、Copilot instructions 等都在解决同一问题：怎样让 Agent 获得组织做事方式。下一阶段会强调：

- 知识的来源、owner、有效期和适用范围；
- 文档变化触发 Skill/eval 更新；
- 失败记录自动建议新测试或规则；
- 个人记忆与组织政策分层；
- 使用检索/工具搜索降低全量上下文成本。

“Context Engineering” 会从提示技巧升级为知识生命周期与权限工程。

## 4.4 企业办公入口减少，后台 Agent 增多

**信心：中高。**

员工不会愿意分别学习几十个领域 Agent。更可能是 Teams/ChatGPT/Gemini/企业门户等少数入口，背后由 Agent registry 和 orchestrator 路由到专业 Agent。应用 UI 不会消失，但更多成为 Artifact 审查和异常处理界面。

## 4.5 Agentic commerce 出现有限闭环

**信心：中。**

AP2/UCP 等协议为可验证意图、支付授权和商户交互提供基础。未来一年会在旅行、零售、采购等有限场景出现 Agent 研究—比较—下单闭环，但默认额度、商户白名单、确认页面和争议责任仍会限制全自治。

## 五、低信心但高影响事件

## 5.1 公共 Agent 网络快速形成

**信心：低，影响：高。**

开放 Agent Card、A2A 和支付协议具备技术基础，但垃圾 Agent、身份欺诈、能力不可验证、计费争议和 prompt injection 会阻碍开放网络。短期更可能是受信联盟和平台内网络。

## 5.2 多 Agent 在大多数任务上稳定优于单 Agent

**信心：低。**

多 Agent 对并行检索、独立审查和模块化迁移有价值，但协调、上下文复制、合并和错误传播成本很高。除非模型/运行时能自动判断“何时不应多 Agent”，否则 Swarm 仍会被过度使用。

## 5.3 自主记忆成为可靠企业事实层

**信心：低。**

自动记忆适合偏好和工作技巧，但把模型总结直接当长期事实会导致污染和陈旧。企业事实层仍应由有 owner、版本、ACL 和生命周期的数据/知识系统承担。

## 5.4 一个协议统一全部 Agent 交互

**信心：很低。**

工具、Agent、客户端、用户界面、支付的语义不同。更可能是协议组合、网关和 SDK 适配，而非 MCP 或 A2A 吞并一切。

## 六、未来市场可能的结构

### 1. 模型厂商 Agent OS

OpenAI、Anthropic、Google 等继续把模型、Harness、云运行、桌面/移动入口、Skills/MCP、记忆和多 Agent 统一。其优势是联合优化和分发，风险是模型与工作数据锁定。

### 2. 工作系统 Agent Fabric

Microsoft、Salesforce、ServiceNow、Google Workspace 等利用企业身份、数据和流程成为领域控制面。它们不一定拥有最好模型，但拥有行动发生的系统。

### 3. 开源 Agent Runtime

OpenCode、OpenHands、goose、Cline、LangGraph、CrewAI 等提供可自建与可替换的运行时。它们会围绕托管、治理、支持和企业分发商业化。

### 4. 独立 Agent 控制与安全层

Agent identity、gateway、observability、eval、安全、cost routing 会形成独立市场，也可能被云/IAM/APM 厂商吸收。

### 5. 垂直 Agent 产品

研发、客服、销售、财务、法务、医疗等领域会形成具备专业数据、工具和验收的 Agent。长期价值更可能在这些领域闭环，而不是通用聊天壳。

## 七、对中国市场的特殊判断

## 7.1 国产 Coding Agent 将强化全栈闭环

**信心：高。**

Qoder、TRAE 等会继续把模型、Repo 知识、IDE、浏览器、数据库、部署和移动端连成工作台。国内竞争不只比代码模型，也比免费/订阅策略、中文知识、云资源、网络体验和企业采购能力。

## 7.2 国内外版本分化持续

**信心：高。**

模型许可、数据跨境、主体和付款差异会使同一品牌的中国版与全球版保留差异。企业不能用海外评测直接推断国内可用模型和数据条款，也不能用国内生态优势推断海外合规。

## 7.3 私有化与混合部署需求增加

**信心：中高。**

金融、政务、制造和大型企业会要求本地模型/专有云、代码不出域、统一网关和审计。开源 Harness + 国产/私有模型的可行性会上升，但复杂编码质量仍需按真实仓库验证。

## 7.4 协议兼容成为出海和生态要求

**信心：中高。**

即使国内平台有自有插件系统，支持 MCP、A2A、Agent Skills/AGENTS.md 等开放接口也会降低客户锁定担忧，并帮助连接国际 SaaS 与开发生态。

## 八、需要持续观察的 20 个指标

### 协议与基础设施

1. MCP 最新 spec 在主流客户端的实际实现比例；
2. MCP Registry 的签名、评分和企业私有目录能力；
3. A2A 跨厂商真实生产案例，而非同平台 Demo；
4. Agent Card 能力验证和身份标准；
5. ACP 在 Zed 之外的 IDE 采用；
6. AG-UI/A2UI 对生成式界面的收敛情况；
7. AP2/UCP 的真实交易量和争议处理。

### Coding Agent

8. 从 issue 到被合并 PR 的一次通过率；
9. 多 Agent 对比单 Agent 的净质量/成本；
10. 任务持续时间和断点恢复成功率；
11. Agent 生成代码的长期缺陷与维护负担；
12. 人类评审队列是否成为瓶颈；
13. AGENTS.md/Skills 的跨产品兼容度；
14. 本地/开源模型在复杂工具调用上的差距。

### 企业与治理

15. Agent identity 和委派 token 的标准化；
16. 影子 Agent/MCP 的发现与封禁能力；
17. 企业从 PoC 到生产的真实转化率；
18. 每个成功任务的全成本，而非 token 单价；
19. Agent 安全事故、prompt injection 和越权案例；
20. 监管对自动决策、责任、披露和审计的具体要求。

## 九、三种情景

### 基准情景（最可能）

Agent 在研发和办公中稳步扩大，但主要是受监督委托；MCP 成为通用工具接口，A2A 在平台与合作伙伴网络内采用；企业建设统一目录、身份、审计和评测。人类评审仍是关键瓶颈。

### 加速情景

长任务模型、checkpoint、工具搜索和自验证显著改善，多 Agent 成本下降；Agent 可独立完成数天任务，企业快速把 backlog 变成后台队列。软件交付和知识工作组织方式在一年内出现明显重构。

### 受挫情景

高影响安全事故、代码质量/维护问题、成本和监管使企业收紧自治；大量 Agent PoC 被取消，市场回到 Copilot + 确定性 workflow，开放协议继续存在但跨 Agent 生产采用放缓。

现实很可能在不同任务上同时呈现三种情景：低风险研发维护加速，高风险办公保持受监督，开放公网 Agent 网络受挫。

## 十、现在的低后悔下注

1. 建立真实任务 eval，而不是追逐宣传 benchmark；
2. 把仓库和 SOP 变成可移植的 AGENTS.md、Skills、tests 和 tool schema；
3. 用 MCP，但通过企业目录、最小权限和网关使用；
4. 让所有 Agent 工作有 owner、预算、trace、timeout 和 kill switch；
5. 用 worktree/sandbox 隔离并行修改；
6. 把跨 Agent 协作建立在 Artifact 和明确 schema 上；
7. 优先自动化可验证、可撤销、低风险闭环；
8. 保持模型/Harness 可替换，不把唯一知识锁在私有 memory；
9. 同时统计速度、质量、成本和人类认知负担；
10. 每季度重测，因为产品能力与经济性都在快速变化。

## 十一、结语

Agent 时代的关键能力不是“让 AI 自由行动”，而是把组织目标、知识、工具、权限和验收变成机器可理解、可执行、可监督的结构。未来一年最强的团队，不一定拥有最多 Agent，而会最先学会把 Agent 当作一种有身份、有预算、有边界、有证据的生产工作负载来运营。
