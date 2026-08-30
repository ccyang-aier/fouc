# 企业办公 Agent 新范式：从 Copilot、流程自动化到数字劳动力网络

> 核心判断：企业办公 Agent 的主战场不是聊天体验，而是能否在组织身份、业务数据、审批、审计和责任边界下完成跨系统工作。

## 一、企业办公 Agent 与传统办公助手/RPA 的区别

| 形态 | 输入 | 执行逻辑 | 环境 | 失败处理 | 适合任务 |
|---|---|---|---|---|---|
| Chatbot | 问题 | 单轮/多轮生成 | 对话上下文 | 用户识别错误 | 问答、摘要、草稿 |
| Copilot | 用户正在做的工作 | 建议与局部操作 | 当前文档/应用 | 用户持续监督 | 写作、分析、编辑 |
| RPA/Workflow | 结构化事件 | 预定义流程 | 稳定 UI/API | 规则分支、人工队列 | 高重复、强规则流程 |
| Agent | 目标与约束 | 动态规划、工具选择、迭代 | 多数据源/应用 | 自检、重试、升级人工 | 半结构化、例外较多的知识工作 |
| Multi-Agent | 跨域结果 | 领域 Agent 协商和委派 | 多部门/多平台 | 分层升级、仲裁 | 端到端跨职能流程 |

Agent 不会替代所有 RPA。合理的组合是：Agent 负责理解非结构化输入、选择路径、处理例外；Workflow/RPA/API 负责确定性执行；人类负责高风险决策、模糊目标和责任签字。

## 二、过去一年企业平台的共同收敛方向

## 2.1 Microsoft：Microsoft 365 Copilot + Copilot Studio + Agent Framework

Microsoft 的路线分成三层：

- Microsoft 365 Copilot 是员工入口和 Office/Graph 上下文；
- Copilot Studio 用低代码构建领域 Agent、知识、动作和多 Agent 编排；
- Microsoft Agent Framework / Foundry 为专业开发团队提供模型中立、状态、middleware、telemetry 和 graph workflow。

Microsoft 在 Build 2025 [公布 Copilot Studio 多 Agent orchestration](https://www.microsoft.com/en-us/microsoft-365/blog/2025/05/19/introducing-microsoft-365-copilot-tuning-multi-agent-orchestration-and-more-from-microsoft-build-2025/)。当前文档已覆盖 parent、child、connected agents，同时明确提示多 Agent 并非总是必要。企业优势是 Entra、Graph、Teams、Power Platform、Dynamics 和 Fabric 的身份/数据/流程协同；风险是产品层级、许可、环境和预览状态较复杂。

## 2.2 Google：Workspace + Gemini Enterprise + ADK/A2A

Google 的路线以 Workspace 为员工数据面，以 Gemini Enterprise（承接 Agentspace 路线）提供统一搜索、Agent 入口、无代码工作台、预构建 Agent、连接器与治理，再以 ADK/A2A 支持专业 Agent 和跨平台互操作。

[Google Workspace 企业页面](https://workspace.google.com/intl/en_id/enterprise/)把 Gemini Enterprise 描述为一个安全运行企业 Agent 的平台。其潜在优势是 Gmail、Drive、Docs、Sheets、Meet 与搜索/云数据的结合；企业需要验证 Workspace 版本、区域、数据边界以及跨 Microsoft 365/Salesforce 等连接器的权限映射。

## 2.3 Salesforce：Agentforce 从单一 CRM Agent 转向多 Agent 企业

Salesforce 拥有 CRM 数据、业务对象、Flow 和权限体系，Agentforce 的自然优势是销售、服务、营销、Commerce 等客户流程。其当前路线包括：

- 单组织多 Agent 编排；
- 通过 MCP 连接外部工具/API；
- 通过 A2A 与 Google、Microsoft 或其他兼容 Agent 协作；
- AgentExchange/模板生态；
- 统一客户数据和业务动作。

Salesforce 官方帮助对 [SOMA 与 MCP/A2A](https://help.salesforce.com/s/articleView?id=005317683&language=en_US&type=1)进行了分层：组织内多个 Agent 用编排协作，外部工具用 MCP，跨平台 Agent 用 A2A。这与本文的协议分层一致。

## 2.4 ServiceNow：从工作流平台升级为 Agent Fabric

ServiceNow 的优势是 ITSM、HR、客户服务和企业工作流。AI Agent Studio 让业务团队通过自然语言定义 Agent，AI Agent Orchestrator 组织专业 Agent；当前 [AI Agent Fabric](https://www.servicenow.com/platform/action-fabric.html)进一步支持 MCP 和 A2A，把 ServiceNow 能力暴露给外部 Agent，也让内部 Agent 调外部系统。

它代表一种重要趋势：原来的 workflow/data fabric 厂商会把自己升级为 Agent control plane，因为它们已经拥有任务、状态、审批、SLA、权限和审计数据。

## 2.5 ChatGPT Work / Codex：知识工作与工程工作的边界融合

OpenAI 官方当前将 ChatGPT Work 定位为研究、分析、文档、表格、幻灯片等知识工作，将 Codex 定位为理解代码库、构建、测试和评审；但两者已通过桌面任务、插件、Skills、MCP、文件、浏览器、计算机使用和长期任务趋于统一。

这意味着企业“办公 Agent”和“Coding Agent”会共享同一基础设施：身份、连接器、Skills、沙箱、审批、任务和审计。财务分析可能需要写 SQL/Python，研发事故复盘可能需要读 Slack/工单/监控并生成演示文档，边界不再由传统应用菜单决定。

## 三、企业办公的六种高价值模式

## 3.1 知识汇集 Agent

从邮件、会议、文档、工单和数据仓库汇集信息，输出带来源的简报、客户 360、项目状态或决策材料。

适合先落地，因为读取为主、结果可人工评审。关键要求是 ACL-aware retrieval：Agent 只能看到当前用户本来就有权限看到的内容，不能因建立统一索引而扩大访问。

## 3.2 事件驱动的流程 Agent

由新邮件、新工单、指标异常、合同到期等事件触发，Agent 分类、补全信息、选择流程并把确定性步骤交给 workflow。

例：客户投诉进入后，Agent 判断产品/物流/账单问题，查询订单和历史，生成建议；退款超过阈值时转人工批准，批准后由确定性 API 执行。

## 3.3 主管—专家 Agent 团队

一个面向员工的入口 Agent 负责理解目标，向财务、法务、HR、IT 等领域 Agent 委派，再汇总结果。每个领域 Agent 在自己的数据、工具和政策边界内工作。

这比一个“万能企业 Agent”更可治理，但必须解决委派身份、上下文最小披露和结果责任。不要把所有原始对话广播给所有子 Agent。

## 3.4 Agent + 人类审批工作台

Agent 准备材料、提出行动方案和影响预览，人类在一个队列中批量批准、驳回或修改。适用于采购、付款、合同、招聘、生产变更等高风险动作。

高质量审批不是弹一个“Allow?”，而应展示：谁请求、目标是什么、将读写哪些对象、金额/范围、依据、可撤销性、后续 Agent 和审计编号。

## 3.5 长期目标 Agent

Agent 不是一次回答，而是持续数天或数周追踪目标，例如供应商迁移、新员工入职、季度经营回顾、缺陷清零。它需要持久状态、日程/事件唤醒、checkpoint、SLA、超时和人工接管。

这一类价值很高，也最容易产生“无人负责的自动化”。每个长期目标必须有 owner、预算、结束条件和 kill switch。

## 3.6 个人数字工作台

个人开发者或知识工作者会把 Agent 当作统一执行入口：研究→写方案→建原型→处理邮件→制作数据表→部署。真正的效率来自上下文和制品在任务间复用，而不是每个应用内单独多一个聊天框。

## 四、典型端到端案例

## 4.1 新员工入职

1. HR 系统事件触发入职 Agent；
2. Agent 读取岗位、地点、经理和合同状态；
3. 通过 A2A 委派 IT Agent、设施 Agent、培训 Agent；
4. 各 Agent 通过 MCP/API 调账号、设备、门禁、课程工具；
5. 高权限账号和设备采购进入人工审批；
6. 所有任务状态汇总到员工/经理页面；
7. 未完成项按 SLA 升级；
8. 入职结束后回收临时权限并归档审计。

这个案例说明：Agent 的价值是处理变体和协作，真正执行仍大量依靠身份系统、工单和 workflow。

## 4.2 销售机会到合同

销售 Agent 汇总邮件/会议/CRM，研究 Agent 补充客户信息，报价 Agent 查询价格与库存，法务 Agent 检查条款，最终由销售负责人确认发送。跨域 Agent 只交换必要 Artifact，例如标准化报价需求、风险条款列表，不应共享全部客户邮箱上下文。

## 4.3 软件事故处理

监控告警触发 Incident Agent，读取日志和变更，委派多个假设调查 Agent；Coding Agent 准备修复和测试，沟通 Agent 草拟状态更新，发布 Agent 在批准后部署。整个链路用同一 trace ID，把模型推理摘要、工具调用、代码 Diff、审批和生产结果串起来。

## 五、企业 Agent 的目标架构

### 1. Experience plane

Teams/Slack/ChatGPT/Workspace/门户/IDE 等少数入口，提供对话、任务板、Artifact、Diff、审批和接管，而不是暴露所有内部 Agent。

### 2. Orchestration plane

负责目标分解、确定性工作流、Agent 路由、长任务状态、人类介入和错误恢复。应同时支持 graph/workflow 与动态 Agent planning，不能只靠模型自由规划。

### 3. Capability plane

领域 Agent、MCP tools、传统 API、RPA、数据产品和 Skills。每项能力有 owner、版本、schema、SLA、数据等级、风险等级和测试集。

### 4. Context plane

企业搜索、知识图谱、向量/关键词检索、会话记忆、用户偏好、业务状态。要区分：事实源、临时上下文、推断、个人记忆和组织规则，避免把模型总结当权威事实。

### 5. Trust/control plane

Agent identity、用户代理关系、短期凭证、策略、沙箱、网络出口、DLP、内容安全、审批、审计、成本和 kill switch。

### 6. Evaluation/observability plane

trace、tool call、token/费用、延迟、完成率、重试、人工介入、风险事件、业务 KPI。支持离线回放、golden tasks、红队和线上 canary。

## 六、治理：必须把 Agent 当作新型工作负载身份

[NIST AI Agent Standards Initiative](https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative)已把 Agent 身份和授权列为重点。[Microsoft Entra Agent ID 的最小权限指导](https://learn.microsoft.com/en-us/security/zero-trust/sfi/least-privilege-for-ai-agents)也反映同一趋势：企业需要知道 Agent 的创建者、owner、生命周期、权限和活动。

### Agent 注册信息最低集

| 字段 | 说明 |
|---|---|
| Agent ID / 名称 / 版本 | 唯一标识与变更追踪 |
| Owner / 业务责任人 / 技术责任人 | 谁批准、谁维护、谁承担结果责任 |
| Purpose / 禁止用途 | 允许解决什么，不允许做什么 |
| Data classification | 可读写数据级别、地域和保留规则 |
| Tools / downstream agents | 可调用能力及版本 |
| Identity mode | 代表用户、服务身份或独立 Agent 身份 |
| Autonomy level | 只建议、可草拟、可低风险执行、需审批执行 |
| Budget / rate limits | 金额、token、并发、时间和资源上限 |
| Evals / SLO | 上线阈值与持续质量目标 |
| Kill switch / expiry | 停止方式、自动失效和复审日期 |

### 最小权限原则的 Agent 化

传统系统授予用户长期角色；Agent 更适合按具体任务发放 **短期、目的绑定、资源限定** 的权限。例如“在未来 15 分钟内，代表 Alice 为订单 123 创建不超过 500 元的退款草稿”，而不是给 Agent 一个长期 CRM 管理员 token。

### 责任链

跨 Agent 委派时应保留：原始用户、父 Agent、子 Agent、授权目的、scope 缩减、数据传递、执行结果和批准者。A2A 解决消息互操作，但完整责任链仍需企业 Mesh/身份系统实现。

## 七、主要安全与运营风险

[OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)把 Agent 行为劫持、工具滥用、身份与权限滥用等列为核心风险。落到办公场景，尤其要关注：

1. **间接 prompt injection**：邮件、网页、文档中隐藏指令诱导 Agent 泄密或执行动作；
2. **过度权限**：Agent 使用共享服务账号，导致一个错误横跨多个系统；
3. **记忆污染**：错误或恶意内容被存为长期事实；
4. **委派放大**：子 Agent 获得比父任务更广权限；
5. **不可逆副作用**：群发邮件、付款、删除、生产变更；
6. **身份混淆**：接收方无法区分用户本人、Agent 草稿和 Agent 自动发送；
7. **影子 Agent**：员工自行接入 MCP/插件，把公司数据发送到未知服务；
8. **级联失败**：一个 Agent 的错误 Artifact 被多个下游 Agent 当成事实；
9. **成本拒绝服务**：循环委派、多 Agent 爆炸、无限重试；
10. **审计空洞**：只记录最终文本，没有记录工具参数、授权和外部副作用。

## 八、价值评估：不要只算节省工时

### 四类价值

- **速度**：墙钟时间、等待时间、队列积压；
- **人力释放**：人类主动操作时间、切换次数；
- **质量**：缺陷、遗漏、合规、标准化；
- **能力扩张**：以前因成本过高而不做的分析、个性化和长尾服务。

### 全成本

- 模型与 Agent 平台费用；
- 工具/连接器和数据索引；
- 人类评审和返工；
- 安全、审计、评测和平台运维；
- 错误副作用、客户信任和合规事件；
- 供应商锁定与迁移成本。

[Gartner 2025 预测](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027)称超过 40% 的 Agentic AI 项目可能因成本、价值不清或风险控制不足而在 2027 年底前取消。该预测不能当成事实结果，但非常准确地指出了三类失败原因。项目立项时必须有业务基线、对照组和退出条件。

## 九、组织方式会怎样改变

### 从岗位软件到能力目录

过去员工学习 CRM、ERP、Excel、工单系统；未来员工更多表达目标，由 Agent 调用底层能力。IT 架构从“给人做菜单”逐渐增加“给 Agent 做结构化、可授权的 capability”。

### 从 SOP 文档到可执行 Skill

高质量 SOP 会被重写为：触发条件、输入 schema、步骤、工具、验证、升级条件和示例，打包成 Skill/Workflow。流程所有者要像产品经理维护软件一样维护这些执行知识。

### 从应用管理员到 Agent 平台与领域负责人

新角色包括 Agent product owner、context engineer、eval engineer、Agent security/identity owner、AI workflow designer。并非人人都要成为“提示工程师”，但领域专家需要参与定义验收和异常边界。

### 从按席位采购到按工作量治理

Agent 可以同时运行多个任务，传统每人一个软件席位的管理方式不够。企业会关注每类任务的成本、成功率、风险和算力，并设置预算和路由策略。

## 十、落地优先级

### 优先

- 读多写少、可引用来源的研究/汇总；
- 草稿和建议，人类最终发送；
- 可用测试或规则验证的研发任务；
- 动作可撤销、范围有限的工单和数据更新；
- 高频、队列化、已有明确 SLA 的流程。

### 慎重

- 付款、合同签署、解雇、医疗/法律结论；
- 开放互联网输入直接触发内部高权限工具；
- 共享超级账号的跨系统 Agent；
- 无 owner、无预算、无结束条件的长期 Agent；
- 一开始就建设全公司万能 Agent 或大而全 Mesh。

## 十一、最终判断

未来企业不会只有一个超级 Agent，也不会允许每个团队无限制地产生私有 Agent。更可能的平衡是：少数统一入口、多个受治理的领域 Agent、确定性 workflow 与 Agent 推理混合、MCP/A2A 互操作、统一身份和 Mesh 控制面。

真正的竞争优势不是采购了哪个聊天机器人，而是企业是否把数据、权限、SOP、验收标准和领域知识改造成 Agent 可安全消费的“组织 API”。

