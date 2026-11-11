# Fouc

> 面向个人与企业团队的 AI Agent 超级工作台。

Fouc 不是新的 Coding Agent。它构建在 Codex、Claude Code、OpenCode 等 Agent 之上，统一组织任务、上下文、工具、人员与工作流程，让复杂工作可执行、可监督、可验证、可闭环。

## 背景与目标

AI Agent 正在从辅助工具演进为能够接受委托、持续执行并交付结果的新型工作能力。与此同时，个人和团队使用的 Agent、代码仓、文档、环境、业务系统与协作流程仍然彼此分散，缺少统一的工作入口、执行控制和结果治理。

Fouc 的目标是成为 Agent 原生的超级工作台：

- 纳管用户已有的 Agent、工具、项目与数据连接；
- 以目标和工作对象组织任务，而不是以聊天会话组织工作；
- 支持人与 Agent 在同一条流程中分工、审批、接管与协作；
- 让执行过程可观察，权限边界可控制，最终结果可验证；
- 同时服务个人与团队，并从研发扩展到研究、分析和日常办公。

## 版本规划

Fouc 正在实现 **V1**；页面、演示数据与设计文档不等于对应业务能力已经交付。

### V1

V1 负责建立 Fouc 最小但完整的 Agent 工作底座，并用远程问题定位与研发问题闭环验证其实际价值。

| 规划特性 | 优先级 | 状态 |
|---|---|---|
| 本机 Agent 自动发现与统一纳管 | P0 | 未完成 |
| 统一工作对象与 Work Room | P0 | 未完成 |
| 本地—远程联合诊断 | P0 | 未完成 |
| 多仓隔离工作区与受管 Agent 编排 | P0 | 未完成 |
| 可执行研发流程、验证与交付闭环 | P1 | 未完成 |

详细范围、验收标准与实现路线见 [V1 产品文档](./docs/product/V1/README.md)。

## 技术栈

- Next.js App Router + React + TypeScript
- Tailwind CSS v4 + Radix primitives
- Tauri v2
- Tauri 原生应用存储

## 本地开发

环境要求：Node.js 22+、pnpm 10.29.3、Bun、Docker Engine 与 Compose；Windows 使用 WSL 中的 Docker（默认 `Ubuntu-22.04`，可设置 `FOUC_WSL_DISTRO`）。开发桌面壳时还需要 Rust 与平台工具链。

```bash
pnpm install
pnpm dev:all
```

`dev:all` 一次启动或复用 PostgreSQL、Redis、MinIO，以及本仓库 Web、设备运行时和业务服务。业务服务配置使用 Git 忽略的 `.env.fouc.local`，首次自动生成本地密钥，并仅对空数据库初始化当前结构；已有数据库执行结构检查，已有容器和数据卷保留。三个应用进程先全部启动，再分别等待 HTTP 200；Web 首次页面编译最多等待 180 秒，设备与业务服务各等待 45 秒。退出命令后服务常驻，Next.js 与 Bun watch 自动刷新源码，日志位于 `.runtime/dev/`。单独启动前端仍使用 `pnpm dev`。

基础设施按当前仓库目录标签、服务标签和发布端口识别已有容器，不依赖 Compose 项目名称。缺失服务才由 Compose 创建；新网络会避开现有 Docker 网络和宿主接口网段，选中的网段写入 `.env.fouc.local` 的 `FOUC_DEV_SUBNET`。Windows 每次启动会同步 PostgreSQL、Redis、MinIO 的 WSL 地址；地址变化时重启本仓库业务服务 watcher，使连接配置生效。无需手动启动依赖；也可用 `node backend/server/scripts/infra.mjs up|verify|status` 单独管理或检查基础设施。

默认就绪端点为 `http://localhost:3000/`、`http://127.0.0.1:8710/health`、`http://127.0.0.1:8711/api/auth/ok`，只有全部返回 200 才报告成功；PostgreSQL、Redis、MinIO 还分别执行主机侧 SQL 登录、认证 PING 和签名对象读写检查。Web 可通过进程环境或 `.env.fouc.local` 中的 `FOUC_WEB_PORT` 指定其他端口，同时将对应网页 origin 加入 `FOUC_AUTH_TRUSTED_ORIGINS`。启动逻辑的定向回归使用 `pnpm test:dev`。前后端职责和分发边界见[项目结构设计](./docs/product/V1/design/arch/fouc-project-structure-design.md)。

查看有数据的数据库连接列表与工作台时，启动开发服务后运行：

```bash
node scripts/seed-connector-demo.mjs
```

该命令启动或复用 MySQL 开发容器，在设备连接目录配置 SQLite 和 MySQL 电商运营示例，各包含 4 张表、1 个视图与 18 笔订单；重复执行复用同名连接。SQLite 文件位于 `.runtime/connector-demo/commerce.sqlite`，MySQL 使用独立示例库与只读账号，设备服务重启后重新验证所需密码位于 Git 忽略的 `.runtime/connector-demo/mysql-connection.json`。

Web 开发默认连接真实 sidecar。需要启用浏览器 Mock 时，在启动进程中设置连接器列表（逗号分隔）：

```powershell
$env:NEXT_PUBLIC_FOUC_MOCKS="dts"
pnpm dev
```

也可以将同名变量写入本地 `.env.local`；可用值示例见 `.env.example`。

```bash
pnpm check           # 类型检查、Lint 与 Web 构建
pnpm desktop:dev     # 启动桌面端开发环境
pnpm desktop:build   # 构建桌面端安装产物
```

后端可分别使用 `pnpm device:*` 与 `pnpm server:*` 的 `dev`、`typecheck`、`test`、`build` 命令；`pnpm backend:build` 只生成桌面设备 sidecar，`pnpm server:build` 生成独立业务服务。跨包边界运行 `pnpm architecture:verify`，DBX 任务表运行 `pnpm dbx:verify`。

## 文档

- [全部文档导航](./docs/README.md)
- [产品文档导航](./docs/product/README.md)
- [产品愿景与定位](./docs/product/vision-and-positioning.md)
- [V1 产品文档](./docs/product/V1/README.md)
- [Agent 研发与企业办公调研](./docs/background/README.md)
