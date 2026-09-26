# W02 · Whisper 音视频时间戳转写验收

日期：2026-09-26，Windows 本机开发环境。W02 实现及其范围内真实验收完成；没有把测试探针或模拟文本作为识别验收。

## 交付与边界

- `media_worker/whisper.py`：生产 `transcribe` 处理器，使用真实 faster-whisper / CTranslate2 推理。PyAV 解码音频或视频第一条音轨，保留模型返回的分段时间戳。
- `media_worker/whisper_config.py`：受信任服务端模型、独立缓存、计算参数、解码时长与下载预算配置；HTTP 请求不能选择任意模型仓库或本地路径。
- `media_worker/processors.py`：复用 W01 逐任务隔离子进程与超时/取消/清理机制；新增可观察且脱敏的模型、依赖、设备及媒体错误。
- `scripts/prepare_whisper.py`：显式准备公开模型，下载前检查总预算，固定本次仓库 revision，核对文件大小与 LFS SHA-256。HTTP 推理只读本地模型，不联网下载。
- `scripts/prepare_samples.py` / `scripts/check-whisper.mjs`：真实语音及视频容器样本准备；真实 MinIO 短期签名 GET → HTTP → 隔离子进程 → 转写验收。
- `tests/test_whisper.py`、后端 Media Worker 客户端及测试：配置、缺依赖/模型、实际解码样本限制、损坏媒体与新错误协议。

Python 服务没有数据库、队列或独立业务存储，没有读取用户模型 API Key。临时媒体只属于单次请求，模型缓存不属于业务资产。Graphile Worker 的任务重试、`asset.derived` 写入与索引仍由后续 TypeScript 任务完成。Docling 尚未实现，`parse_document` 仍明确返回 `503 processor_unavailable`。

## 实际推理环境

| 项目 | 实际值 |
| --- | --- |
| 系统 / Python | Windows / Python 3.12.9，项目独立 `.venv` |
| faster-whisper | 1.2.1 |
| CTranslate2 / PyAV | 4.8.2 / 18.1.0 |
| NumPy / ONNX Runtime | 2.5.3 / 1.30.0 |
| 模型 | 公开 `Systran/faster-whisper-tiny`，多语言 tiny |
| revision | `d90ca5fe260221311c53c58e660288d3deb8d356` |
| 实际模型文件总量 | 78,203,619 字节；默认下载预算 256 MiB |
| model.bin SHA-256 | `dcb76c6586fc06cbdac6dd21f14cfd129cc4cdd9dce19bf4ffa62e59cbe6e6d1` |
| 推理参数 | CPU、int8、2 线程、beam size 5、temperature 0、VAD 开启 |
| 常驻接口 | `http://127.0.0.1:8910`，认证操作列表 `["transcribe"]` |
| 启动器 PID（当次证据） | 56144，已核对为本项目 `.venv/Scripts/python.exe -m media_worker` |

`config.json / model.bin / tokenizer.json / vocabulary.txt` 的逐文件字节数和 SHA-256 保存在被忽略的 `.cache/models/tiny/fouc-model.json`。模型来源为 [faster-whisper 官方实现](https://github.com/SYSTRAN/faster-whisper/tree/v1.2.1) 对应的 [公开 tiny 仓库](https://huggingface.co/Systran/faster-whisper-tiny/tree/d90ca5fe260221311c53c58e660288d3deb8d356)。下载不使用隐式 Hugging Face token，也不读取用户模型网关密钥。

## 真实样本与结果

语音来源是 [OpenAI Whisper 官方 JFK 测试音频](https://raw.githubusercontent.com/openai/whisper/main/tests/jfk.flac)，并按其 [官方测试](https://github.com/openai/whisper/blob/main/tests/test_transcribe.py) 中的语音关键词验证实际输出。

| 样本 | 字节数 / 时长 | 实际媒体轨 | 本轮 HTTP 耗时 |
| --- | --- | --- | --- |
| `jfk.flac` | 1,152,693 / 11 秒 | FLAC 音频 | 1,343 ms |
| `jfk-video.mp4` | 141,041 / 11 秒 | H.264 视频 + AAC 音频 | 1,327 ms |
| 同一音频，超时后新 attempt | 同上 | FLAC 音频 | 1,358 ms |

音频 SHA-256 为 `63a4b1e4c1dc655ac70961ffbf518acd249df237e5a0152faae9a4a836949715`；视频 SHA-256 为 `ec8124e67e87cc6e54b5968a79fd1e5eac891b11cec476c6825f420f47638e92`。

视频由本机已有 FFmpeg 把同一真实语音与黑色视频轨封装生成，验证真实视频容器解码；它不是第二个独立声学来源，未据此声称多样本准确率。

两种容器均实际返回 `processor: "faster-whisper:tiny"`、`derived.status: "ready"`，包含一个 `start: 0, end: 11` 的时间戳段。音频识别文本为：

> And so, my fellow Americans, ask not what your country can do for you, ask what you can do for your country.

视频结果仅标点有差异。验收使用识别关键词、非空文本及合法时间范围，不声称 WER、中文识别或所有模型档位的准确率已经验收。

最新无秘密验收记录为 `.runtime/whisper-verification.json`，记录时间 `2026-09-26T05:43:08.827Z`（北京时间 13:43:08）。记录包含请求 UUID、源文件哈希、真实识别结果、时间戳、耗时与失败码，不包含签名 URL、token 或存储秘密。

## 失败、超时、取消与重试

| 真实 HTTP 情况 | 结果 | retryable |
| --- | --- | --- |
| 故意损坏的 FLAC 对象 | 422 `invalid_media` | false |
| 真实音频，语言 `zz` | 422 `unsupported_language` | false |
| 总任务期限 1 ms | 504 `task_timeout` | true |
| 同一音频，新的 requestId 重试 | 200，真实转写成功 | 不适用 |
| 调用方 200 ms 后 abort，客户端显式取消服务端任务 | `task_cancelled` | false |

1 ms 验证的是包含下载和推理的**整体 HTTP 期限**，不声称超时一定发生于模型推理阶段。取消验证实际生产请求的客户端/服务端协议；W01 的实际 spawn/HTTP 生命周期测试继续验证子进程与临时目录回收，不以模拟识别替代本次真实推理。

缺依赖、缺本地模型、无效设备/精度分别返回 `dependency_missing / model_unavailable / device_unavailable`。配置问题不可盲目重试；解码时长超过配置返回 `413 media_too_long`。逐帧统计实际 16 kHz 采样数，不依赖不可信容器声明的时长。

验收每次只上传随机 `w02-verification/<UUID>/` 前缀下的三个测试对象，最后定向删除这三个对象。两轮均实际完成清理；可重新下载的模型与真实样本保留在精确 gitignored `.cache/` 中，未操作其他 S3 对象。

## 已通过检查与复现

- **33 项 Python 测试**：在 W01 生命周期/边界测试基础上，新增模型配置、缺依赖/模型、真实 WAV 解码、解码时长上限及空/损坏媒体错误验证。
- **8 项客户端测试**：Bun 运行，以及编译为 Node 目标后由纯 Node 24 运行，均通过；包含新增处理器错误协议。
- **严格类型检查**：定向客户端 TypeScript 检查和 `pnpm backend:typecheck` 通过。
- **真实生产链路**：两轮音频、视频、坏文件、deadline、新 attempt 和取消验收通过；第二轮还包含不支持语言验证。
- **常驻服务**：开发服务使用上述已核对进程；`dev.py status` 真实验证 health、鉴权 capabilities、401、严格 422，操作列表为 `["transcribe"]`。
- **Web 保持运行**：`http://localhost:3000/` 实测 HTTP 200；未停止或替换 Next.js dev/HMR，未构建 Tauri。

仓库根目录复验命令：

```powershell
.\services\media-worker\.venv\Scripts\python.exe -m pytest -q services/media-worker
bun test backend/src/knowledge/media/client.test.ts
pnpm backend:typecheck
.\services\media-worker\.venv\Scripts\python.exe services/media-worker/dev.py status
bun build backend/src/knowledge/media/client.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.mjs
node services/media-worker/scripts/check-client.mjs
bun build backend/src/knowledge/media/client.test.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.test.mjs
node --test services/media-worker/.runtime/client.test.mjs
node services/media-worker/scripts/check-whisper.mjs
```

新环境还需按 README 创建 venv、安装 requirements，并执行 `scripts/prepare_whisper.py` 与 `scripts/prepare_samples.py`。模型准备和服务启动需要使用同一组 `MEDIA_WORKER_WHISPER_*` 配置。模型下载失败会真实报错，不会由 mock、空文本或隐式联网推理补过验收。

## 未宣称完成的范围

- GPU、其他模型大小、其他语种及长媒体准确率未实测；本次只确认 CPU/int8/tiny 的真实链路。配置可选择其他模型或既有本地 CTranslate2 模型路径，但需要对应环境准备与验收。
- Linux/POSIX、Docker 镜像、独立进程组的取消 race 和容器临时目录回收仍须 Z03 验证；不以 Windows 通过代替 Linux 验收。
- Python 开发服务不自动重载，沿用 W01 已验证的隐藏常驻方案；本次已定向重启本项目进程装载新处理器。Web dev/HMR 不受影响。
- 没有实现 Docling，也没有冒充已完成 Graphile 调度、`asset.derived` 落库或媒体重索引闭环。
- 本任务未修改根 compose/env/package/lock/任务表，未提交 Git；由主代理验收后统一提交。
