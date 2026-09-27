# 项目结构重构与验证记录

日期：2026-09-27。依据：[最终项目结构设计](./fouc-project-structure-design.md)。

## 已落地结构

保留根目录 `src/`、`src-tauri/`、`shared/` 和 `services/media-worker/`，将原混合后端拆为两个独立 workspace 包。

```text
backend/
├─ README.md
├─ device/                         @fouc/device
│  ├─ package.json、tsconfig.json
│  ├─ scripts/                     设备审批、DTS 及 ACP 验证
│  └─ src/
│     ├─ entrypoints/index.ts       设备进程装配及桥分发
│     ├─ agents/、bridges/、execution/
│     ├─ connectors/、database/     设备可达的外部系统和 MySQL
│     ├─ knowledge/                保留已有本地文档仓储能力
│     ├─ collaboration/            设备协作宿主
│     ├─ storage/                  SQLite 设备状态及文档副本
│     ├─ api/                      设备 HTTP/WS 边界
│     └─ platform/                 设备环境及平台适配
└─ server/                         @fouc/server
   ├─ package.json、tsconfig.json
   ├─ scripts/                     基础设施、数据库、作业与模型工具
   └─ src/
      ├─ entrypoints/server.ts      统一业务服务装配
      ├─ platform/                 身份、PostgreSQL、运行配置及日志
      └─ modules/knowledge/        已有业务领域与用例
         └─ api/                   知识库 HTTP/tRPC 边界
```

`backend/` 不再具有 package.json、tsconfig 或混合 src；运行依赖、开发入口、类型检查、测试和构建分别归属设备包与业务包。未实现的业务模块不创建空目录。

## 行为保持与边界修正

- 现有 HTTP/WS 路径、账户及设备认证方式、存储位置、数据库 schema、领域操作与权限判断保持；仅生成 SQL 的来源注释随路径更新，无数据格式迁移或兼容分支。
- 原设备侧 Agent、连接器、MySQL、SQLite 及本地文档能力完整归入设备包；设备协作不再引用服务端授权上下文。
- 原账户、组织、PostgreSQL、协作、索引、模型、媒体编排和 MCP 实现归入业务包；媒体 Python 进程保持独立。
- 两侧统一消费现有共享协作文档命名协议，删除重复实现；测试协议客户端归入 `qa/helpers/`，不进入运行时。
- 前端通过 `@fouc/server/knowledge-api` 的公开 type-only 导出获取真实路由类型。编译两个类型入口分别得到不足 100 字节的浏览器代码，不含数据库、账户或 Node 实现。
- Agent 桥通过标准模块解析定位工件，源码与 Bun bundle 均可正确解析；新增实际 Claude/Codex 工件定位及缺失工件行为测试。
- 无页面组件、CSS、布局或视觉资产改动。前端实现变更仅涉及公开类型入口与 AI 查询键的 useMemo，查询及交互语义保持。
- 更新 workspace、锁文件、环境示例、Compose build context、脚本、Tauri 开发路径、sidecar 编译入口和相关文档；旧深层源码别名不保留。

## 验证结果

| 检查 | 结果与覆盖 |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | 四个 workspace 可按锁文件安装，无缺失依赖或锁文件漂移 |
| 前端、设备、业务服务及共享类型检查 | 全部通过 |
| `pnpm lint` | 通过，零错误、零警告；排除生成缓存及 Python 虚拟环境 |
| `pnpm architecture:verify` | 791 个源码/脚本文件通过；禁止跨后端内部导入、前端运行时后端依赖、共享平台依赖及未声明直接依赖 |
| 架构、知识边界与任务验证器测试 | 13 个通过，覆盖类型/动态导入绕过、公开契约和依赖反转拒绝 |
| `pnpm knowledge:verify` | 99 个任务、42 个章节、80 项既有验收记录保持完整，代码路径更新后无缺失证据或循环依赖 |
| `pnpm test:frontend` | 859 个前端及共享测试通过；Bun isolate 防止 DOM/IndexedDB 全局状态在文件间泄漏 |
| 后端确定性回归及已配置服务集成 | 596 个通过，真实 Ollama 流式用例单独列为不稳定项；涵盖账户、RLS、权限、组织、协作、存储、队列、媒体编排、索引、搜索、AI 工具、MCP、设备连接器及 MySQL 边界 |
| `pnpm device:test` | 从设备包工作目录独立运行，43 个测试通过 |
| `pnpm verify:approval` | ACP 初始化、审批委托、allow_once 不缓存与 allow_always 缓存回放全部通过 |
| `pnpm device:build`、`pnpm server:build` | 两个独立 Bun bundle 构建通过 |
| 设备 sidecar 单文件编译 | Bun compile 通过；只编译设备入口，不执行 Tauri 打包 |
| 构建产物进程检查 | 设备 Bun bundle 与编译 exe 均验证 HTTP 路由、无效 Bearer 拒绝和 WS 鉴权；业务 Bun bundle 验证启动、账户健康与会话路由 |
| `pnpm build` | Next.js 编译、类型检查和 6 个静态页面导出全部通过，保留 `out/` 输出 |
| `pnpm dev:all` | 首次复用 Web 并启动设备/业务进程；再次执行复用同一服务，不重复启动；命令退出后服务持续运行 |

确定性后端回归命令：

```bash
bun test --test-name-pattern '^(?!.*a real local Ollama model streams blocks end to end).*' ./backend/device/src ./backend/server/src
```

该命令仅将已确认波动的真实模型流式用例分开，未删除、放宽或跳过其测试实现。设备产物进程检查使用独立临时数据目录、端口和测试令牌，未修改真实设备配置。

## 浏览器验证

在在线 Web dev 服务验证了现有登录会话恢复，工作空间 `123`、文件夹 `32`、文档 `基础能力验证` 保持可见；已有文档正文和评论线程正常加载，协作状态显示“已同步”。

文档列表验证搜索与无结果反馈、清除搜索后的数据恢复、卡片/网格切换、筛选面板与既有文档打开。连接器、社区与自动化的已有页面内容仍正常呈现；项目入口保持原有 Web 占位行为，本次未将占位功能描述为完整项目业务。验证后返回知识库文档列表。

浏览器最后一次控制台检查未发现 warning/error；本机验证截图保存在忽略提交的 `qa/structure-refactor-documents.png`。

## 基线问题与验证边界

重构前后均执行完整后端测试。重构前为 591 通过、3 失败：真实 Ollama 流式响应不稳定、MCP 归因断言仍期待旧格式、真实检索测试依赖当前工作目录读取模型环境文件。

本次修正 MCP 测试，使用当前共享协议解析并核对客户端名称，不改变业务归因和权限逻辑；模型环境文件改为相对模块定位。首次重构后完整回归为 593 通过、仅 MCP 旧断言失败，其中真实 Ollama 流式用例通过。修正断言及新增桥定位测试后的完整回归为 596 通过、1 个真实 Ollama 用例失败（`invalid_response`）。因此不能宣称真实模型输出已稳定，剩余问题与目录重构无新增关联证据。

按用户会话快速模式保持 Web dev 常驻，未执行完整 Tauri build，也未声称桌面安装包或其他操作系统已验证。已验证桌面所使用的静态前端导出、设备入口编译及编译产物 HTTP/WS 运行能力。

额外尝试的 `pnpm verify:dbx-catalog` 无法完成外部来源对照：本机未检出其依赖的 `opensource/dbx/` 参考仓库。该验证脚本及参考路径未被本次重构改变；实际随 Fouc 使用的目录 JSON、81 个驱动和 104 个配置映射已由设备测试及编译产物路由检查验证。

本次完成组织结构和工程依赖边界。全产品访客主体、细粒度操作授权及登录资源承接仍需模块规则细化；保留已有功能不等于已经实现这些新产品行为。
