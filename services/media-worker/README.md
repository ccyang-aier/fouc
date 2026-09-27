# Fouc Media Worker

无状态 FastAPI HTTP 服务。TypeScript/Graphile Worker 负责业务鉴权、队列重试、资产记录与 `asset.derived` 写入；Python 只下载一次短期 S3 资源，在独立子进程中解析，再返回 JSON。它不读取数据库、Redis、S3 长期凭据或模型网关密钥，没有自己的业务存储或任务队列。

Whisper（W02）通过 `faster-whisper` 真实本地推理实现，模型准备完成后注册 `transcribe`。Docling（W03）真实解析 PDF/DOCX/PPTX/XLSX，返回结构化 Markdown 与独立 PNG 附件；Office 不需要模型，PDF 需要显式准备的本地版面/表格模型。历史 W01 基础层验收保留在 `ACCEPTANCE.md`，转写见 `ACCEPTANCE-WHISPER.md`，文档解析见 `ACCEPTANCE-DOCLING.md`。

## 本地开发

在仓库根目录运行，Python 3.12+：

```powershell
python -m venv services/media-worker/.venv
.\services\media-worker\.venv\Scripts\python.exe -m pip install -r services/media-worker/requirements-dev.txt
python services/media-worker/dev.py init
.\services\media-worker\.venv\Scripts\python.exe services/media-worker/scripts/prepare_whisper.py
.\services\media-worker\.venv\Scripts\python.exe services/media-worker/scripts/prepare_docling.py
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

文档可以另带 `attachments: [{ sha256, mime: 'image/png', size, width, height, dataBase64 }]`，它是 **HTTP 临时产物**，不属于 `asset.derived`。Markdown 只以 `![Image](asset:<sha256>)` 引用实际提取图片，不嵌入 base64、文件路径或临时 URL。服务与 Node 客户端复核 PNG 头、尺寸、SHA-256、实际字节数、规范 base64、重复哈希及图片引用集合；提取图按内容去重。最多 32 张、单图和总图字节均最多 1 MiB、单图最多 4 MP，另受整个 JSON 响应默认 2 MiB 限制。超限明确失败，不静默截掉图片。附件只有在 AS01/W05 完成同工作区资源写入后才成为可访问资产。

错误统一为 `{ requestId: string | null, error: { code, message, retryable } }`，不回显请求内容、下载 URL、token、模型异常文本或文件路径。重要状态：401 鉴权、409 同 requestId 正在运行、413 资源超限、422 输入/资源完整性错误、429 并发已满、499 已取消、502 下载/处理失败、503 能力/模型/计算环境不可用、504 下载或任务超时。输入、HTTP 响应与客户端都拒绝未知字段；客户端还复核 requestId、assetHash 与操作，避免错配派生结果。

处理器进一步区分 `dependency_missing / model_unavailable / device_unavailable / invalid_media / media_too_long / unsupported_language`，不会回传第三方库异常原文。配置问题、损坏媒体与不支持的语言不可盲目重试；HTTP/下载超时可交给 Graphile Worker 重试，Python 不创建重试队列。

文档错误为 `invalid_document`（422，损坏/不安全/加密或格式不匹配）、`empty_document`（422，无可提取内容）、`unsupported_document_content`（422，已检测图片无法由本地管线提取）、`document_limit_exceeded`（413，文档/图像资源超限）。这些不是暂态错误，不应盲目重试；Docling 的部分成功不会被包装为完整 ready 结果。

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

后端使用 `backend/server/src/modules/knowledge/media/client.ts` 的 `createMediaWorkerClient({ baseUrl, token })`，传入 `MEDIA_WORKER_URL` 和相同的 `MEDIA_WORKER_TOKEN`。客户端使用 Node 标准 `fetch / AbortSignal / Buffer`，不依赖 Bun 专有 API；`process(request, signal)` 支持调用方取消。

## Whisper 模型与缓存

实现使用 [SYSTRAN faster-whisper](https://github.com/SYSTRAN/faster-whisper/tree/v1.2.1) 和 CTranslate2，本地 PyAV 解码音频或视频的第一条音轨，不执行用户提供的命令。CPU 的 `compute_type=auto` 解析为 int8，CUDA 为 float16；未具备请求的设备/精度时返回明确错误。

`prepare_whisper.py` 是显式模型准备命令。它先读取公开模型元数据，按预算检查总字节数，再固定该次 revision 下载白名单文件，验证字节数和 LFS SHA-256，生成缓存内 `fouc-model.json`。默认 tiny 约 78 MB；下载预算默认 256 MiB，选择大模型时必须显式提高预算。只使用公开匿名下载（`token=False`），不读取用户模型 API Key。短暂下载失败最多安全重试 2 次，不用失败结果冒充已准备。

HTTP 推理只加载本地目录，设置 `local_files_only=True` 和 Hugging Face offline/禁用隐式 token；缺缓存返回 `model_unavailable`，不会在请求过程中联网补下载。缓存是可重新生成的模型文件，不是业务资产存储，默认位于被精确忽略的 `.cache/models/`。

以下变量均以 `MEDIA_WORKER_WHISPER_` 开头：

| 后缀 | 默认值 | 说明 |
| --- | --- | --- |
| `MODEL` | `tiny` | tiny/base/small/medium（含 `.en`）、large-v3 或 turbo |
| `CACHE_DIR` | 本服务 `.cache/models/` | 显式准备的独立缓存根目录 |
| `MODEL_PATH` | 未设置 | 可选，直接加载已转换的本地 CTranslate2 模型目录；不下载 |
| `BEAM_SIZE` | `5` | 1–10，转写使用 temperature 0 |
| `VAD_FILTER` | `true` | Silero VAD；时间戳由真实推理返回并保留原始音轨坐标 |
| `MAX_AUDIO_SECONDS` | `3600` | 1–14400；逐帧统计实际 16 kHz 解码采样数，防止仅依赖容器元数据 |
| `MAX_DOWNLOAD_BYTES` | 256 MiB | 仅准备命令使用，最大 8 GiB |

真实模型验证：

```powershell
.\services\media-worker\.venv\Scripts\python.exe services/media-worker/scripts/prepare_samples.py
bun build backend/server/src/modules/knowledge/media/client.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.mjs
node services/media-worker/scripts/check-whisper.mjs
```

样本命令从 OpenAI 官方 Whisper 测试仓库下载真实 JFK 语音，并用已有 FFmpeg 封装为含 H.264 视频轨/AAC 音轨的 MP4；两者同源，不代表两个独立声学样本。验收命令仅读取本项目 MinIO 开发凭据，把随机测试对象上传到独立知识库 bucket，使用真实短期签名 GET 调用生产 HTTP 接口，完成后删除这些测试对象；不会打印凭据或签名 URL。音视频原文件和无秘密的验收 JSON 保留在忽略目录，供复跑。

## Docling 文档与图片

使用 [Docling 官方最小可选依赖包](https://github.com/docling-project/docling/tree/v2.130.0) 的 PDF、Office 和本地模型能力，没有安装全量 VLM、音视频或远程服务功能。默认 PDF 模型是 Heron 版面分析 + `fast` TableFormer，共 317,123,044 字节；只取选定文件，预下载时按 revision/字节数/SHA-256 校验，清单位于 `.cache/models/docling/fouc-models.json`。选择 `accurate` 需重新显式准备对应权重，不会在请求中补下载。

默认只处理 PDF 文本层，**扫描 PDF 文字没有做 OCR**，没有虚假的 OCR 配置开关。只含图片的文档可返回实际提取的图片附件与图片引用，但不代表已经得到可检索文字。图片描述/OCR 属于设计 §8.2 的 W04 vision 处理；Docling 未下载 OCR、图片描述、公式或代码 VLM 权重，也不会调用用户模型 API。图表位图保留为图片，未声称识别其数值或语义。

PDF 采用标准模型管线，保留标题、表格结构和图像。Office 采用真实格式后端；例如 Excel 标题单元格仍作为单元格/表格保留，不伪造 Word 标题层级。不启用 LibreOffice 图表渲染，并在转换期间关闭固定版本 Docling 的自动 LibreOffice 发现入口，避免外部应用启动及不受 Python 网络保护的加载器；无法提取的图片明确失败，不伪造占位图。

解析只接受服务已经下载到单次任务目录的文件，启用 Hugging Face/Transformers offline 与禁止隐式 token。禁用远程服务/外部插件；解析期间对 Python socket connect、DNS 和 connection API 加禁止网络保护。这是受信任依赖的纵深保护，不是操作系统沙箱。PDF 在模型执行前检查页数、页面渲染像素；OOXML 检查成员数量、总解压字节、路径穿越、加密标记和安全 XML（含 UTF-16 的 DTD/实体拒绝）。真实图片像素解码、图片数量及 PNG 输出均有限额。

以下变量以 `MEDIA_WORKER_DOCLING_` 开头；模型准备命令与服务启动必须使用一致配置：

| 后缀 | 默认值 | 用途 |
| --- | --- | --- |
| `ARTIFACTS_PATH` | 本服务 `.cache/models/docling/` | 本地模型目录；不读取全局模型缓存 |
| `TABLE_MODE` | `fast` | `fast / accurate`；改变后显式准备模型 |
| `MAX_DOWNLOAD_BYTES` | 512 MiB | 准备阶段全部选定权重预算，最大 2 GiB |
| `MAX_FILE_BYTES` | 50 MiB | 文档压缩文件输入限制，另受服务下载限制 |
| `MAX_PAGES` | 100 | PDF 页、PPTX 幻灯片、XLSX sheet 上限；DOCX 流式版式不伪造页数 |
| `MAX_PAGE_PIXELS` | 10 MP | 按 PDF 页面 2x 渲染面积限制 |
| `MAX_ZIP_ENTRIES` / `MAX_UNCOMPRESSED_BYTES` | 5000 / 128 MiB | OOXML 容器限制 |
| `MAX_IMAGES` / `MAX_IMAGE_PIXELS` | 32 / 4 MP | 可调低，不得超过协议上限 |
| `MAX_IMAGE_BYTES` / `MAX_TOTAL_IMAGE_BYTES` | 各 1 MiB | 单图及去重后图片总字节，可调低 |

Docling 使用公共 `DEVICE / DEVICE_INDEX / CPU_THREADS`，CPU 路径为 PyTorch float32；公共 `COMPUTE_TYPE` 是 Whisper 的量化选择，不宣称 Docling 支持 int8。逐任务隔离意味着每次重新加载模型：本机有文本层单页 PDF 约 10–13 秒，Office 约 5–6 秒；不是长文档吞吐或 GPU 基准。OS 内存硬限制及 Linux 生命周期属于 Z03。

```powershell
.\services\media-worker\.venv\Scripts\python.exe services/media-worker/scripts/prepare_documents.py
bun build backend/server/src/modules/knowledge/media/client.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.mjs
node services/media-worker/scripts/check-docling.mjs
```

样本由 ReportLab、python-docx、python-pptx、openpyxl、Pillow 生成，包含真实标题、表格及图片像素，不手写文件二进制。PDF 样本经过 Poppler 渲染检查。验收走真实 MinIO 短期 GET 和生产 HTTP；原文件、提取图预览与无秘密的记录留在忽略目录。`verification-storage.mjs` 仅是两套验收脚本共用的 S3 测试传输，不进入 Python 服务。

### AS01/W05 持久化交接

1. W05 校验响应与源资产对应关系；复核附件字节、PNG、哈希和限制，使用源资产的同一 `workspace_id`，不能从 Python 响应推断租户。
2. 经 AS01 幂等写入提取图的同工作区 S3 对象和 `asset` 记录。相同哈希可复用，但不得使用跨工作区存在性查询泄露信息；Python 的 `asset:<hash>` 引用此时才有持久化对象。
3. 在附件均可用且源任务仍有效后，事务提交派生结果、图像关联及 outbox/重索引事件。失败或取消时不得提交悬空引用；S3 与数据库没有跨系统原子事务，新建但未引用的对象需要明确的补偿/垃圾回收策略，不能删除已经被其他记录复用的对象。
4. 只有 `derived` 写入派生字段；附件 base64 只用于受限传输，不写入 Markdown、检索文本或 AI 上下文。图片描述/OCR 后续走 W04 vision，不由 Docling 静默推断。

这些是调用边界要求，**W03 没有实现或验收业务资源持久化**。

## 处理器注册接口

在 `media_worker/processors.py` 的 `default_registry()` 中注册真实实现：

```python
registry.register("transcribe", whisper_spec())
registry.register("parse_document", docling_spec())
```

注册函数接受 `ProcessorInput`（本次只读源文件、MIME、language、device/index、compute_type、cpu_threads），以及 `ProcessorSpec.options` 传入的受信任静态配置，统一同步返回 `{ derived: ready结果, attachments?: 附件数组 }`，没有旧返回格式兼容分支。`whisper_spec()` 会检查依赖和本地模型是否已准备；Docling Office 不依赖权重，PDF 在调用时额外检查本地模型。不可用的注册项不会出现在 operations 中，但调用时会得到具体错误码。入口必须由受信任代码注册，HTTP 不能传入模块路径或覆盖模型配置。函数参数不含 S3 签名 URL 或 Worker token；子进程进入解析前还会从自身环境移除 Worker token。实现可以使用同一临时目录，不得将资产或结果持久化到业务存储。处理器可抛出 `ProcessorFailure` 的白名单错误码，其他异常统一脱敏。

## 验证

```powershell
.\services\media-worker\.venv\Scripts\python.exe -m pytest -q services/media-worker
bun test backend/server/src/modules/knowledge/media/client.test.ts
pnpm backend:typecheck
bun build backend/server/src/modules/knowledge/media/client.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.mjs
node services/media-worker/scripts/check-client.mjs
bun build backend/server/src/modules/knowledge/media/client.test.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.test.mjs
node --test services/media-worker/.runtime/client.test.mjs
```

Python 测试中的 `tests.probes` 只是 IPC/取消测试探针，真实 HTTP 测试使用临时回环端口，并在结束时关闭其服务器；它们不导入生产注册表，也不是 Whisper/Docling 的准确率验收。详见本目录 `ACCEPTANCE.md`。
