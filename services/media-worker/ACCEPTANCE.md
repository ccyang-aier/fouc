# W01 · 无状态 Media Worker HTTP 基础服务验收

日期：2026-09-26，Windows 本机开发环境。状态：W01 实现与范围内真实验收完成；Whisper / Docling 模型解析不属于本次已完成能力。

## 交付边界

- `media_worker/app.py`：FastAPI 健康、能力、同步处理与显式取消接口；认证先于 JSON 解析，严格输入、统一脱敏错误、并发限制、断连/关闭取消。
- `media_worker/contracts.py`：严格请求/响应，UUID、资产哈希、MIME、期限、转写时间顺序及操作/派生类型对应关系。
- `media_worker/download.py`：精确 origin 白名单、短期 S3 SigV4 URL、禁止跳转/环境代理/压缩内容、流式字节上限、声明大小及 SHA-256 校验。
- `media_worker/processors.py`：受信任静态注册，逐任务 spawn 子进程、结果大小限制、终止与临时文件清理。生产注册表为空，不安装测试探针。
- `media_worker/config.py`：CPU/CUDA/auto、compute type、线程/并发/输入输出/期限限制；必需秘密配置错误只暴露字段名。
- `backend/server/src/modules/knowledge/media/client.ts`：Node 兼容客户端，复用共享 `assetDerivedSchema`、UUID、哈希与时间契约；响应关联性、大小/结构验证、超时与主动取消。
- `dev.py`、requirements、Dockerfile、README、目录内精确 `.gitignore`：独立虚拟环境、隐藏常驻开发服务与复现方式。

没有添加数据库驱动、Redis 客户端或 Python 队列；没有读取用户模型密钥文件；没有写入业务资产存储。所有 SQL、Graphile Worker 调度、业务授权、持久化派生结果及重索引仍由后续 TypeScript 任务负责。

## 实际运行环境

| 项目 | 实际值 |
| --- | --- |
| Python | 3.12.9，独立 `services/media-worker/.venv` |
| FastAPI / Uvicorn | 0.141.1 / 0.54.0 |
| HTTPX / Pydantic | 0.28.1 / 2.13.5 |
| Node / Bun | 24.16.0 / 1.4.0 |
| 常驻地址 | `http://127.0.0.1:8910` |
| 最终启动器 PID | `27032`，`.venv/Scripts/python.exe -m media_worker`；仅是当次证据 |
| 实际生产操作列表 | `[]`，尚未安装 Whisper/Docling |
| 默认设备配置 | `cpu`；不宣称 CUDA 实际可用 |

本地 token 只保存在 gitignored `services/media-worker/.env.local`，从未打印或写入本报告。`.venv/`、`.env.local`、`.runtime/server.log` 均已由 `git check-ignore` 验证。没有修改根 compose/env/package/lock/计划表，没有提交 Git 或构建 Tauri。

## 已通过验证

1. **27 项 Python 测试通过**：认证、未知字段/类型拒绝、CPU/GPU 配置解析、JSON Content-Length 与 chunked 大小限制、来源白名单、期限与签名参数、URL 凭据/重复参数拒绝、禁止重定向、压缩拒绝、下载长度/哈希/流式上限/超时、模型子进程异常及输出上限、服务关闭清理、子进程移除服务 token。
2. **真实子进程执行**：测试探针运行于实际 spawn 子进程；显式取消、deadline 与服务关闭后，无活动子进程、无临时任务文件。该探针只验证 IPC 与生命周期，不是文档/音视频识别。
3. **真实 HTTP 测试**：临时 Uvicorn 和本地 HTTP 源服务器实际启动，通过 socket 下载。验证 401、504、DELETE 取消后的 499，以及长任务客户端断连后 3 秒内回收；断连任务自身期限是 30 秒，因此不是等待自然超时造成的假通过。测试服务器退出后关闭。
4. **7 项客户端行为测试通过**：Bun 运行一遍，编译成 Node 目标后由 Node 24 独立运行同样 7 项，均通过。覆盖身份/资产关联、共享派生语义、错误脱敏与 retryable、响应大小/格式、客户端 timeout/abort 对服务端发出取消。
5. **Node → 常驻 FastAPI 实测**：health 200、鉴权 capabilities 200、错误 token 401、未注册处理能力返回 `503 processor_unavailable`。未伪造识别结果。
6. **TypeScript 严格检查**：客户端定向检查和 `pnpm backend:typecheck` 均通过。过程中并行 Markdown 实现的类型错误已由其负责代理修复，本任务未修改 Markdown 文件。
7. **常驻与隔离**：最终恢复稳定隐藏进程并再次完成 Python/Node live verify。原有 Next.js `http://localhost:3000/` 返回 HTTP 200，Web dev/HMR 未被本任务停止或替换。

可复验命令（仓库根目录）：

```powershell
.\services\media-worker\.venv\Scripts\python.exe -m pytest -q services/media-worker
bun test backend/server/src/modules/knowledge/media/client.test.ts
pnpm backend:typecheck
python services/media-worker/dev.py verify
bun build backend/server/src/modules/knowledge/media/client.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.mjs
node services/media-worker/scripts/check-client.mjs
bun build backend/server/src/modules/knowledge/media/client.test.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.test.mjs
node --test services/media-worker/.runtime/client.test.mjs
```

## 如实记录的限制与后续验收

- **W02/W03 未验收**：没有安装 Whisper/Docling，没有下载模型或调用模型 API，真实音视频与 PDF/Office 解析仍须各自完成。测试目录与 Docker 生产镜像隔离，默认注册表没有测试实现。
- **Windows 开发服务不自动热重载**：实际发现 Uvicorn Windows reload 的 `CTRL_C_EVENT → join` 在隐藏会话挂起；独立隐藏 console 亦未修复，故撤回额外 reload 功能，保留已验证的稳定常驻入口。修改媒体 Python 代码后需核对 PID/路径/命令行，定向重启本项目服务并重新检查 capabilities；不会笼统结束其他 Python 进程。用户要求的 Next.js Web dev/HMR 不受影响。
- **Linux/POSIX 尚未实测**：代码有独立进程组终止及 `setsid` 尚未建立时的 `ProcessLookupError → process.kill()` fallback，但本次不能以 Windows 成功宣称 Linux 验收成功；Z03 必须用 Linux 容器验证取消 race、子进程树及临时目录回收。
- **GPU 尚未实测**：W01 只验证配置严格解析，不证明 CUDA/模型可用。
- **Dockerfile 尚未构建验收**：本次真实服务在 Windows venv 中运行；Compose 五组件装配与 Linux 镜像验收属于 Z03。
- **没有伪造完整业务闭环**：本次没有 Graphile 长任务调度、资产落库、媒体重索引或生产对象权限隔离验收；这些边界保持在后续任务。
