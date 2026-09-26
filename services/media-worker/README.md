# Fouc Media Worker

无状态 FastAPI HTTP 服务。TypeScript/Graphile Worker 负责业务鉴权、队列重试、资产记录与 `asset.derived` 写入；Python 只下载一次短期 S3 资源，在独立子进程中解析，再返回 JSON。它不读取数据库、Redis、S3 长期凭据或模型网关密钥，没有自己的业务存储或任务队列。

W01 只交付安全的 HTTP/执行边界。生产注册表当前为空，Whisper（W02）与 Docling（W03）尚未实现；对应请求明确返回 `503 processor_unavailable`，不会生成占位转写或伪造 Markdown。

## 本地开发

在仓库根目录运行，Python 3.12+：

```powershell
python -m venv services/media-worker/.venv
.\services\media-worker\.venv\Scripts\python.exe -m pip install -r services/media-worker/requirements-dev.txt
python services/media-worker/dev.py init
python services/media-worker/dev.py start
python services/media-worker/dev.py verify
```

`init` 只首次生成 `services/media-worker/.env.local` 中的新 Bearer token，不显示秘密、不覆盖已有文件。虚拟环境、凭据、日志和 PID 均被目录内精确 `.gitignore` 忽略。没有全局 Python 安装。

`start` 使用隐藏常驻进程，默认监听 `127.0.0.1:8910`；复用已通过相同凭据验证的服务，端口被其他服务占用时明确失败，不结束其他进程。运行日志位于 `.runtime/server.log`，访问日志关闭以防泄露签名 URL。无需占用或重启 Next.js 的 `localhost:3000`，Web dev/HMR 保持正常。

Python 服务当前不自动热重载。已实际发现 Uvicorn 的 Windows reload 通过 `CTRL_C_EVENT` 重启子进程时会在隐藏会话中挂起，因此没有保留该未通过验证的额外功能。W02/W03 更新 Python 源码后，应核对 `.runtime/server.pid` 对应进程的路径与命令行，只定向停止本项目启动的进程树，再运行 `dev.py start` 并检查 capabilities；不要终止其他 Python 进程。

生产入口为 `python -m media_worker`（不自动重载）。本目录 Dockerfile 以非 root 用户运行该入口；Compose 五组件装配在后续 Z03 完成。

## HTTP 契约

| 接口 | 鉴权 | 语义 |
| --- | --- | --- |
| `GET /health` | 无 | 仅返回 `{ "service": "fouc-media-worker", "status": "ok" }` |
| `GET /v1/capabilities` | Bearer token | 实际注册的操作、配置设备与资源限制；设备配置不宣称 GPU 已可用 |
| `POST /v1/process` | Bearer token | 同步 HTTP 长任务；成功返回派生结果，不在 Python 侧排队或持久化 |
| `DELETE /v1/tasks/{requestId}` | Bearer token | 取消本节点正在执行的 HTTP 任务，并等待子进程/临时目录清理 |

请求形状：

```typescript
{
  requestId: string; // UUID，由 Graphile Worker 调用方提供
  operation: 'transcribe' | 'parse_document';
  timeoutMs?: number; // 默认 600000，范围 1..3600000；服务端还会应用自身上限
  language?: string; // 仅 transcribe，例如 zh、en
  resource: {
    url: string; // S3 SigV4 预签名 GET URL
    expiresAt: string; // 含时区，必须与 X-Amz-Date + X-Amz-Expires 一致
    sha256: string; // 64 位小写十六进制
    size: number; // 精确字节数
    mime: string; // 与操作匹配的明确 MIME 类型
  };
}
```

成功响应包含 `requestId / operation / assetHash / derived / processor / elapsedMs`。`derived` 是共享 `assetDerivedSchema` 的 ready 子集：文档只返回 `{ status: 'ready', markdown }`，音视频只返回 `{ status: 'ready', transcript: [{ start, end, text }] }`。时间戳必须非负且 end 不早于 start；不得返回与请求操作不匹配的结果。

错误统一为 `{ requestId: string | null, error: { code, message, retryable } }`，不回显请求内容、下载 URL、token、模型异常文本或文件路径。重要状态：401 鉴权、409 同 requestId 正在运行、413 资源超限、422 输入/资源完整性错误、429 并发已满、499 已取消、502 下载/处理失败、503 能力未安装、504 下载或任务超时。输入、HTTP 响应与客户端都拒绝未知字段；客户端还复核 requestId、assetHash 与操作，避免错配派生结果。

## 限制与取消

- 下载白名单是部署方设置的精确 HTTP(S) origin，可明确允许私有 S3/MinIO 地址；不接受通配符、用户名密码、片段或任意目标。只接受带有限期限的 S3 SigV4 URL；其签名真实性由对象存储校验。
- 禁止跳转和内容编码，不向下载地址转发 Worker token。HTTPX 设置 `trust_env=False`，避免从环境代理或 `.netrc` 隐式继承凭据。[HTTPX 配置说明](https://www.python-httpx.org/api/)
- 流式核对声明长度、实际字节数和 SHA-256；对 JSON 请求、下载、输出、并发和总执行时间分别设限。文件名由服务端 MIME 映射生成，客户端不能指定本地路径。
- 每个解析在 spawn 子进程中执行。超时、显式取消、客户端断连或服务关闭都会终止子进程树；Windows 使用限定为本次创建 PID 的 `taskkill /T`，POSIX 使用该子进程独立进程组。临时文件只在单次请求目录中存在，清理后无派生结果留存。
- 不自动重试。`retryable` 供 Graphile Worker 制定重试策略；取消不是持久任务状态，完成任务再次取消返回 404。跨节点取消依赖原 HTTP 连接断连保障，因此不用新增共享取消数据库。

## 配置

所有变量均以 `MEDIA_WORKER_` 开头；token 和 download origins 必填，其他有默认值。

| 后缀 | 默认值 | 范围/用途 |
| --- | --- | --- |
| `TOKEN` | 必填 | 32–256 字符，不含空白，独立于用户模型 API Key |
| `DOWNLOAD_ORIGINS` | 必填 | 逗号分隔精确 origin；本机开发生成 `http://127.0.0.1:59000` |
| `HOST` / `PORT` | `127.0.0.1` / `8910` | Docker 内默认 host 为 `0.0.0.0`，部署时仍应限内网 |
| `DEVICE` / `DEVICE_INDEX` | `cpu` / `0` | `cpu / cuda / auto`；GPU index 0–31 |
| `COMPUTE_TYPE` / `CPU_THREADS` | `auto` / `2` | `auto / float32 / float16 / int8`；CPU 禁止 float16；线程 1–64 |
| `MAX_CONCURRENCY` | `2` | 1–16，超限直接 429，不建立等待队列 |
| `MAX_BYTES` | 512 MiB | 最大 5 GiB |
| `MAX_REQUEST_BYTES` | 16 KiB | 1–64 KiB，包含 chunked 请求 |
| `MAX_RESPONSE_BYTES` | 2 MiB | 1 KiB–16 MiB；契约另限单 Markdown 文本 2 MiB |
| `TASK_TIMEOUT_SECONDS` | `600` | 大于 0，最多 3600 |
| `DOWNLOAD_TIMEOUT_SECONDS` | `60` | 大于 0，最多 600 |
| `MAX_RESOURCE_TTL_SECONDS` | `900` | 1–3600，实际 URL 必须未过期 |
| `TEMP_DIR` | 系统临时目录 | 若指定，必须是已存在目录 |

后端使用 `backend/src/knowledge/media/client.ts` 的 `createMediaWorkerClient({ baseUrl, token })`，传入 `MEDIA_WORKER_URL` 和相同的 `MEDIA_WORKER_TOKEN`。客户端使用 Node 标准 `fetch / AbortSignal / Buffer`，不依赖 Bun 专有 API；`process(request, signal)` 支持调用方取消。

## W02 / W03 注册接口

在 `media_worker/processors.py` 的 `default_registry()` 中注册真实实现：

```python
registry.register("transcribe", ProcessorSpec("whisper", "media_worker.whisper:transcribe"))
registry.register("parse_document", ProcessorSpec("docling", "media_worker.docling:parse_document"))
```

注册函数接受 `ProcessorInput`（本次只读源文件、MIME、language、device/index、compute_type、cpu_threads），同步返回 ready 派生结果 dict。入口必须由受信任代码注册，HTTP 不能传入模块路径。函数参数不含 S3 签名 URL 或 Worker token；子进程进入解析前还会从自身环境移除 Worker token。实现可以使用同一临时目录，不得将资产或结果持久化到业务存储；模型下载缓存由 W02/W03 单独定义。

## 验证

```powershell
.\services\media-worker\.venv\Scripts\python.exe -m pytest -q services/media-worker
bun test backend/src/knowledge/media/client.test.ts
pnpm backend:typecheck
bun build backend/src/knowledge/media/client.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.mjs
node services/media-worker/scripts/check-client.mjs
bun build backend/src/knowledge/media/client.test.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.test.mjs
node --test services/media-worker/.runtime/client.test.mjs
```

Python 测试中的 `tests.probes` 只是 IPC/取消测试探针，真实 HTTP 测试使用临时回环端口，并在结束时关闭其服务器；它们不导入生产注册表，也不是 Whisper/Docling 的准确率验收。详见本目录 `ACCEPTANCE.md`。
