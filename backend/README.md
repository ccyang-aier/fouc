# Fouc 后端工程

`backend/` 是组织目录。两套运行系统分别拥有入口、依赖、类型检查、测试与构建，不共享内部代码或存储实现。

| 包 | 职责 | 入口 | 默认开发地址 |
| --- | --- | --- | --- |
| `@fouc/device` | 本机 Agent、执行、设备连接器、SQLite 状态与现有本地知识能力 | `device/src/entrypoints/index.ts` | `http://127.0.0.1:8710` |
| `@fouc/server` | 账户、组织、资源授权、知识内容、协作、作业与 MCP | `server/src/entrypoints/server.ts` | `http://127.0.0.1:8711` |

设备包的 `database/` 实现用户连接的 MySQL 查询能力；服务端 `platform/database/` 管理 Fouc 的 PostgreSQL 业务数据库。两者的数据库不是同一个职责。

服务端 `modules/knowledge/` 按现有用例组织，HTTP/tRPC 边界归入模块的 `api/`；身份、运行配置与数据库基础设施位于 `platform/`。已有知识作业启动脚本在 `server/scripts/`，不创建没有实际实现的项目、社区或调度模块。

设备的协作宿主与 SQLite 副本位于 `device/src/collaboration/` 和 `device/src/storage/`。它们不依赖服务端授权类型；两侧消费共享的文档命名协议。跨运行系统的协作测试客户端在 `qa/helpers/`，只能用于测试。

共享包保存公开契约、目录数据以及编辑文档的纯协议、schema 与编解码实现。前端通过 `@fouc/server/knowledge-api` 获取路由推导类型；该导出只有 `types` 条件，运行时不能加载，浏览器构建不会包含账户、数据库或路由实现。

## 开发与验证

在仓库根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm dev:all
pnpm device:typecheck
pnpm server:typecheck
pnpm device:test
pnpm server:test
pnpm device:build
pnpm server:build
pnpm architecture:verify
pnpm knowledge:verify
```

`dev:all` 校验端口进程属于当前工程并检查 HTTP 就绪状态，复用正确服务；端口被其他工程占用时拒绝覆盖或另选端口。新进程后台常驻，日志在忽略提交的 `.runtime/dev/`。Bun 通过 PATH、标准安装目录或 `FOUC_BUN_PATH` 定位；Unix 上复用监听进程需要 `lsof` 与 `ps`。

业务服务使用根目录 `.env.fouc.local`；可选模型配置在 `.env.knowledge.models.local`。配置初始化、数据库检查、后台作业和基础设施工具在 `server/scripts/`。媒体 Worker 的独立 Python 环境及启动说明见 [`services/media-worker/README.md`](../services/media-worker/README.md)，它不作为无关页面的启动前提。

`pnpm dev`、`device:dev`、`server:dev` 可分别启动单个开发进程。`backend:dev/start` 是仓库级设备命令，`backend:typecheck/test` 聚合两包检查。包构建生成各自 `dist/` 下的 Bun 入口，外部依赖按各包 manifest 安装；当前服务端通过 workspace 消费共享包，部署时须保留共享包及正确 workspace 链接。

桌面只打包设备运行时。`scripts/build-backend.mjs` 编译设备入口，保持原有 `fouc-backend-<target>` 产物名称；Tauri 的开发启动路径同步指向设备入口。Web dev 缓存 `.next/` 与静态构建缓存 `.next-build/` 分开，Web/Tauri 静态前端仍输出到 `out/`。

## 构建与分发边界

| 命令 | 产物 | 用途 |
| --- | --- | --- |
| `pnpm build` | `out/` 静态前端；`.next-build/` 构建缓存 | Web 静态部署或桌面前端资源 |
| `pnpm device:build` | `backend/device/dist/index.js` | 设备包 Bun bundle 验证；外部依赖另行安装 |
| `pnpm backend:build` | `src-tauri/binaries/fouc-backend-<target>[.exe]` | 嵌入 Bun 运行时与依赖的设备可执行文件 |
| `pnpm tauri build` | Windows 下的 `fouc.exe`、`fouc-backend.exe` 和 MSI/NSIS 安装包 | 桌面壳、前端资源与设备运行时一起分发 |
| `pnpm server:build` | `backend/server/dist/server.js` | 独立业务服务 Bun bundle；运行环境、依赖及共享包另行部署 |

`fouc-backend.exe` 的源码来自 `device/`：提供本机 Agent、进程执行、设备连接器与本机状态，由 Tauri 启动、看护和关停。它不包含 `server/` 的业务服务。两个 exe 是桌面的主要可执行程序，不表示安装包内只有两个文件。

Tauri 的 `beforeBuildCommand` 只执行设备单文件编译与前端构建，没有执行 `server:build`。前端编译会读取业务服务公开的 tRPC 类型，但类型检查依赖不等于服务端运行时代码被打包。业务服务集中部署，供 Web 与桌面通过网络访问；开发时运行在本机，不改变这一边界。

## 业务服务语言选择

`server/` 是独立业务后端，当前接口包含 HTTP、tRPC、WebSocket 协作与 MCP，并运行后台作业，因此职责不只是一组 REST 接口。接口协议不限定实现语言；当前工程选择 TypeScript/Bun，不表示独立后端必须使用 TypeScript。

即使从零开始，按当前产品目标也优先选择 TypeScript 实现核心业务服务：复杂操作契约需要与双端前端准确衔接，实时协作与 Agent/工具编排需要纯协议共享和异步 I/O；CPU 计算由明确的 worker 边界承接。共享 schema、tRPC 类型推导以及 Yjs/Hocuspocus、AI 和 MCP 集成是具体收益。已有实现的重写成本不是该结论的必要前提，也不宣称所有未来负载下 TypeScript 都最优。文档解析和模型相关计算使用独立 Python media worker；语言与 Bun/Node 运行时分别评估。详细判断见 [服务端选型与前端审视](../docs/product/V1/design/arch/2026-09-27-server-selection-and-frontend-audit.md)。

独立部署不等于当前实现可以无成本跨语言替换：前端公开 tRPC 类型和共享 TypeScript 协议仍构成编译期耦合。若后续明确选择 Python/Go 实现某项独立能力，应先定义语言无关的网络契约与生成客户端，例如 HTTP 的 OpenAPI，并验证协作协议、授权和事务语义；不能仅替换入口或运行命令。依据实际职责和工程收益选择语言，保持业务服务模块化单体，不为语言差异提前拆分所有业务模块。

## 本次范围

本次落地工程组织与运行边界，保留已有 API、存储模型、权限判断、前端页面和样式。访客主体、登录承接与全产品操作授权仍需对应产品规则；目录拆分不表示这些新能力已实现。后续模块扩展遵循 [`项目结构设计`](../docs/product/V1/design/arch/fouc-project-structure-design.md)。
