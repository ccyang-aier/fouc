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

## 本次范围

本次落地工程组织与运行边界，保留已有 API、存储模型、权限判断、前端页面和样式。访客主体、登录承接与全产品操作授权仍需对应产品规则；目录拆分不表示这些新能力已实现。后续模块扩展遵循 [`项目结构设计`](../docs/product/V1/design/arch/fouc-project-structure-design.md)。
