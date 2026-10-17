# Fouc

本文件是 AI 编码代理在本仓库工作的项目契约与行为准则。

## 产品背景

Fouc 是一套构建于 AI Agent 之上的超级工作台，面向个人与企业团队，支持客户端与 Web 双端。它以人与 Agent 的高效协作为核心，帮助用户敏捷地完成开发、研究、分析与日常办公任务，而不是局限于单一 Coding Agent 场景。

## 技术栈

- Next.js App Router + React + TypeScript（前端，`src/`）
- 后端采用两个独立 TypeScript/Bun workspace 包：`backend/device/` 是桌面设备 sidecar，负责本机 Agent、连接器与执行；`backend/server/` 是统一业务服务，负责账户、共享资源与协作。`backend/` 仅为组织目录；共享契约与跨宿主纯文档协议位于 `shared/`
- Tauri v2（Rust）仅作为系统薄壳（`src-tauri/`）：窗口、系统能力桥、自动更新与后端进程看护；后端业务逻辑不得写入 Rust
- 后端代码保持在 Node 兼容 API 子集内（进程/HTTP/文件操作使用标准 API 与框架抽象），保留退回 Node 运行时的低成本通道
- Tailwind CSS v4 + shadcn/ui-style Radix primitives
- Tauri native application storage for local preferences and state

## 工程边界

- 前端保持在 `src/`，不得导入后端内部实现；tRPC 客户端类型仅通过 `@fouc/server/knowledge-api` 的公开 type-only 导出使用，禁止运行时导入。
- 两个后端包互不导入内部代码；设备包不连接账户与共享业务数据库。跨宿主协议经 `@fouc/shared` 的公开导出使用。
- Python 内容处理仍位于 `services/media-worker/`，不进入桌面 sidecar 的运行与分发依赖。
- `pnpm dev:all` 启动或复用本仓库的 Web、设备运行时和业务服务；服务在命令退出后保持运行并自动刷新源码。
- `pnpm architecture:verify` 验证依赖边界与依赖声明；后端分别使用 `device:*`、`server:*` 命令检查、测试与构建。

## 产品资源模型（必须先于代码命名理解）

- **项目承载统一工作台的业务隔离域**。顶部项目切换是唯一项目入口；任务、资产、成员、聊天与最近记录默认属于当前真实 `projectId`。全产品不新增工作空间实体、全局 `workspaceId` 或虚构默认项目。连接器与社区目录全项目可发现，设备连接、凭据与具体操作仍独立授权。
- **项目与知识库是独立、多实例资源**：项目以 `projectId` 和项目成员权限管理；知识库以 `knowledgeBaseId`、成员、分组、可见性与页面 ACL 管理。项目不包含知识库，知识库也不包含项目；知识库 owner 配置开放项目集合，项目成员资格、开放范围、库成员与页面 ACL 共同限制访问，关联不隐式授予内容权限。知识库下才有文件夹（现存内部名 `teamspace`）与文档；项目引用文档不改变归属或授予权限。
- 项目列表、顶部切换及当前作用域状态归 `features/project`；知识库目录、文件夹和文档归 `features/knowledge`；`src/shell/` 只负责组合与呈现。后端 `modules/projects`、`modules/knowledge` 拥有对应用例，业务表位于 `platform/database/resources`。设备会话和连接以真实 `sessionId`、`connectionId` 校验，不借助产品空间分区。
- 登录态决定主体身份和具体操作权限，不决定整套知识库页面或整个产品的数据模式。访客也能使用允许的功能；本机、服务端和设备能力应按资源与操作明确选择，不因登录、退出自动迁移或替换内容。
- 现有工作台首页、连接器目录与社区部分页面使用演示数据；任务、成员、资产主页面按本次范围先保留空状态，自动化模块已移除；渲染了某项能力不等于已有对应的服务端持久化或资源授权。先核对实际用例与数据所有者，再扩展该能力；当前实现状态见 `docs/product/V1/design/arch/fouc-project-structure-design.md` §2.3。

## 开发理念

- **纯净原则**：始终保持架构与实现纯净，当前产品尚未发布，不存在生产版本、真实用户存量数据或必须兼容的历史格式。架构和数据模型调整必须直接重写为当前唯一正确实现，并清理对应的开发测试数据；禁止为旧开发数据保留 migration、legacy adapter、双轨 schema、兼容分支或过渡开关等。
- **简洁优先**：以满足当前需求的最小复杂度完成实现，不得添加需求之外的功能，不为只使用一次的逻辑过早抽象，不为事实上不可能发生的场景堆砌错误处理；任何新增复杂度必须由真实需求或可验证的工程价值支撑。
- **前端体验完整**：简洁不等于简陋。在清晰架构的基础上追求出色的视觉表现、细腻的状态反馈与完整的交互闭环，以专业设计成果的标准打磨视觉与细节。
- **动效只维护一套实现**：本项目不考虑“减少／减弱动态效果”要求，不依据 `prefers-reduced-motion` 或系统相关偏好关闭、降级或替换动效，不添加对应分支、替代方案或额外测试矩阵。修改已有动效时同步清理其相关分支；通用设计技能中的此类要求不适用于本项目。
- **前端规则复核**：每次前端开发开始与提交前，必须阅读并逐项复核 [AI 前端开发注意事项](AI_FRONTEND_RULES.md)；持续开发时定期审视输入焦点、文案、鼠标指针与危险操作反馈。
- **组件化与边界**：合理拆分职责与边界，避免单文件臃肿，确保代码易于维护、测试与扩展。
- **基于事实判断**：信息不足、方案存在取舍或结论不明确时，明确说明已知事实、疑问、假设与权衡。

## 工作流

- 任务完成并通过验证后执行 Git 提交，提交信息使用规范、清晰的格式。
- **快速开发与并行**：开发阶段仅验证新增或修改部分的必要 P0 功能、权限/数据边界及一次真实视觉流程；已通过的模块不因例行提交反复跑完整矩阵，完整回归集中到阶段末。无依赖任务可交由多个 agent 并行，先明确接口与各自文件范围，由主 agent 统一接线、维护权威文档和提交；共享文件不并发覆盖。
- 开发任务默认保持 `pnpm dev:all` 启动或复用的 Web 开发服务常驻并自动刷新源码。仅在用户明确要求桌面验证、发布或打包时执行 `pnpm tauri build`；Web 改动按需运行 `pnpm build`。
- **文档唯一权威**：产品、架构与实现决策统一维护在 `docs/` 的对应主题设计文档中。每个设计主题只保留一份当前有效的权威文档；后续决策直接修改该文档。不同职责（如连接器框架与 DTS Provider）可以分别成文，但不按日期、任务或重构批次复制设计、建立存档或保留已失效方案。具体代码与测试是实现现状的依据，不另建一套重复的“工程实现说明”。
- **任务进度与清理**：持续推进的大任务在 `.spec/tasks/` 保留任务表、状态和必要的验证摘要，随实施更新；它们是执行跟踪，不是第二份设计。临时截图、比较图、一次性审计、验收报告和中间生成文件可在任务期间使用，任务结束前须清理。持续有效的测试、脚本、源代码和运行所需缓存不因目录名像临时目录就删除；先确认引用与运行状态。

## 按需阅读文档

以下仅是导航；只在任务涉及对应领域时打开相关文档，不要一次性加载全部文档。完整索引见 [docs/README.md](docs/README.md)。

- 产品目标与 V1 范围：[产品定位](docs/product/vision-and-positioning.md)、[V1 导航](docs/product/V1/README.md)。
- 资源模型、工程边界与服务端选型：[项目结构设计](docs/product/V1/design/arch/fouc-project-structure-design.md)。
- 身份、会话和资源授权：[统一身份设计](docs/product/V1/design/identity/fouc-identity.md)。
- 项目体验与工作对象：[项目设计](docs/product/V1/design/projects/fouc-project-space-product-ux-design.md)。
- 知识库与协同编辑：[知识库设计](docs/product/V1/design/knowledgebase/fouc-knowledgebase-product-design.md)。
- 连接器、DTS 与数据存储：[连接器架构](docs/product/V1/design/connectors/connector-architecture.md)、[DTS](docs/product/V1/design/connectors/dts-connector-design.md)、[数据存储](docs/product/V1/design/connectors/data-storage-module-design.md)。
- Agent 纳管：[本机 Agent 设计](docs/product/V1/design/agents/fouc-agent-management-design.md)。
- 长期任务进度：[知识库任务表](.spec/tasks/fouc-knowledgebase-tasks.md)、[DBX 迁移任务表](.spec/tasks/dbx-full-capability-migration.md)；仅在涉及对应任务时阅读。

### 桌面端构建

`beforeBuildCommand`（`node scripts/build-backend.mjs && pnpm build`）在子 shell 中直接调用 `bun`（sidecar 编译）与 `pnpm`（Next.js 导出），两者必须作为独立命令在 PATH 上可解析，仅 `corepack pnpm` 不够。本机 shell PATH 均不含二者：

- pnpm：`corepack enable --install-directory <目录> pnpm` 生成 shim（现成于 `C:\Users\y00013075\.local\corepack-shims`）
- bun：`C:\Users\y00013075\.bun-tool\node_modules\bun\bin`

仅执行桌面构建时，先结束残留的 fouc / fouc-backend 进程：运行中的 sidecar 会锁住 `src-tauri/binaries/` 下旧 exe，`build-backend.mjs` 覆盖时报 EPERM。

```bash
export PATH="/c/Users/y00013075/.local/corepack-shims:/c/Users/y00013075/.bun-tool/node_modules/bun/bin:/d/Nodejs:$PATH"
powershell -NoProfile -Command 'Get-Process fouc* -ErrorAction SilentlyContinue | Stop-Process -Force'
pnpm tauri build   # 产物：src-tauri/target/release/fouc.exe 与 bundle/{msi,nsis}/ 安装包
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
