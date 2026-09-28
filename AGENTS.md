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

- **工作空间是全产品的资源隔离根**。左侧最外层工作空间栏切换当前 `workspaceId`；同一用户可以创建或加入多个工作空间，但当前空间的资源读取、搜索、引用、执行与缓存不得隐式跨到另一空间。身份和平台公开目录不是某个工作空间的私有资源。
- **项目与知识库是工作空间下的同级、多实例资源**：`workspace → projects[]` 与 `workspace → knowledgeBases[]`；项目不包含知识库，知识库也不包含项目。知识库下才有文件夹（现存内部名 `teamspace`）与文档。任何目录名、旧变量名或演示数据的一一对应关系都不能改变该模型。
- 全局工作空间选择归 `features/workspaces`；项目列表、选择及管理状态归 `features/project`；知识库目录、文件夹和文档归 `features/knowledge`。`src/shell/` 只负责组合与呈现。后端 `modules/workspaces`、`modules/projects`、`modules/knowledge` 分别拥有这些用例，数据库业务表统一位于 `platform/database/workspace` 租户边界。
- 登录态决定主体身份和具体操作权限，不决定整套知识库页面或整个产品的数据模式。访客也能使用允许的功能；本机、服务端和设备能力应按资源与操作明确选择，不因登录、退出自动迁移或替换内容。
- 现有项目详情、自动化、连接器目录与社区部分页面使用演示数据；渲染了某项能力不等于已有对应的服务端持久化、空间绑定或授权。先核对实际用例与数据所有者，再扩展该能力；当前实现状态见 `docs/product/V1/design/arch/fouc-project-structure-design.md` §2.3。

## 开发理念

- **纯净原则**：始终保持架构与实现纯净，当前产品尚未发布，不存在生产版本、真实用户存量数据或必须兼容的历史格式。架构和数据模型调整必须直接重写为当前唯一正确实现，并清理对应的开发测试数据；禁止为旧开发数据保留 migration、legacy adapter、双轨 schema、兼容分支或过渡开关等。
- **简洁优先**：以满足当前需求的最小复杂度完成实现，不得添加需求之外的功能，不为只使用一次的逻辑过早抽象，不为事实上不可能发生的场景堆砌错误处理；任何新增复杂度必须由真实需求或可验证的工程价值支撑。
- **前端体验完整**：简洁不等于简陋。在清晰架构的基础上追求出色的视觉表现、细腻的状态反馈与完整的交互闭环，以专业设计成果的标准打磨视觉与细节。
- **组件化与边界**：合理拆分职责与边界，避免单文件臃肿，确保代码易于维护、测试与扩展。
- **基于事实判断**：信息不足、方案存在取舍或结论不明确时，明确说明已知事实、疑问、假设与权衡。

## 工作流

- 任务完成并通过验证后执行 Git 提交，提交信息使用规范、清晰的格式。
- 开发任务默认保持 `pnpm dev:all` 启动或复用的 Web 开发服务常驻并自动刷新源码。仅在用户明确要求桌面验证、发布或打包时执行 `pnpm tauri build`；Web 改动按需运行 `pnpm build`。

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
