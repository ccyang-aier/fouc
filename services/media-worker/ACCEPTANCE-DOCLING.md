# W03 · Docling PDF/Office 结构化解析验收

日期：2026-09-26。环境：Windows 本机，独立 Python venv。结论：W03 范围内的真实 PDF/Office 标题、表格、图片提取及失败边界已完成并验证；没有使用模拟解析文本冒充验收。

主代理独立复核：阅读生产解析器、预检、附件协议、客户端与模型下载实现后，重新运行 **56 Python + 9 Bun + 9 纯 Node** 测试均通过。另独立重跑真实 MinIO→HTTP→Docling：PDF **11,452 ms**、DOCX **5,625 ms**、PPTX **5,733 ms**、XLSX **5,594 ms**，标题/表格/图片通过；四格式各自空/损坏输入、期限后新尝试、取消均通过。本轮自己的 12 个随机前缀测试对象已清理，无业务资产删除。最终真实 health/capabilities/401/422 再次通过；Web dev `localhost:3000` HTTP 200。

## 交付

- `media_worker/docling.py`：真实 Docling 标准 PDF 管线及 DOCX/PPTX/XLSX 格式后端，静态注册 `parse_document`，复用 W01 的可取消 spawn 子进程。
- `docling_config.py` / `document_limits.py`：本地模型与可调低的图片限额；文件、PDF 页数/渲染像素、OOXML 成员/解压总量/路径/安全 XML 等预检。
- `contracts.py` / `processors.py` / `app.py`：统一 `{ derived, attachments? }` 处理器输出和独立 HTTP 图片附件；Whisper 与生命周期探针同步改为唯一新接口，没有兼容双轨。
- `backend/src/knowledge/media/client.ts`：Node 兼容附件验证，PNG 头、尺寸、SHA-256、真实字节数、规范 base64、重复哈希、引用集合及聚合上限。
- `scripts/prepare_docling.py` / `model_download.py`：显式、匿名、受预算的本地模型准备与大小/校验和核验；Whisper 共享同一实际复用的下载校验函数。
- `scripts/prepare_documents.py` / `check-docling.mjs`：真正生成 PDF/OOXML 文档并经真实 MinIO + HTTP 验证；两套媒体验收复用 `verification-storage.mjs`，该测试辅助不进入 Python 服务。
- `tests/test_docling.py`、客户端测试与 README：真实文档、真实像素、资源限额和安全边界，以及 AS01/W05 持久化交接说明。

未改共享 `assetDerivedSchema`，未修改根 compose/env/TS package/lock/任务表；没有 Git 提交或 Tauri 构建。其余并行代理的改动未触碰。

## 真实运行环境和模型

| 项目 | 实际值 |
| --- | --- |
| Python | 3.12.9，`services/media-worker/.venv` |
| Docling slim / core / IBM models / parse | 2.130.0 / 2.99.0 / 4.0.3 / 7.21.0 |
| PyTorch / Transformers | 2.14.0 / 5.17.0 |
| OpenCV headless | 4.13.0.92；补齐 TableFormer 实际使用的 cv2 依赖 |
| python-docx / python-pptx / openpyxl | 1.2.0 / 1.0.2 / 3.1.5 |
| 推理 | CPU、2 线程；Docling float32，Whisper 保持 int8 |
| PDF 模型 | Heron layout + fast TableFormer |
| 模型总下载量 | **317,123,044 字节**，默认 512 MiB 预算 |
| 常驻接口 / 操作 | `127.0.0.1:8910` / `["parse_document", "transcribe"]` |
| 最终启动器 PID（当次证据） | **13392**，本项目 `.venv/Scripts/python.exe -m media_worker` |

Heron 仓库 `docling-project/docling-layout-heron` 固定本次 revision `8f39ad3c0b4c58e9c2d2c84a38465abf757272d8`，权重 171,658,996 字节、SHA-256 `00333a43451945aaf89db8ca9c0a17e75d1537c17db60fdb91aa95f4c7929e0c`。

TableFormer 仓库 `docling-project/docling-models` 的 `v2.3.0` 对应 revision `fc0f2d45e2218ea24bce5045f58a389aed16dc23`，fast 权重 145,453,276 字节、SHA-256 `3119563aab5a7c96fda4d621119b63fd8806272b86c30936d15507616422f718`。只下载这两个模型所需的五个文件，逐文件证据在 `.cache/models/docling/fouc-models.json`。

配置本地 `artifacts_path` 遵循 [Docling 官方离线用法](https://docling-project.github.io/docling/usage/advanced_options/)。没有下载 OCR/VLM/图片描述/公式/代码模型；Office 无需权重。实际用 1,024 字节预算运行准备命令时，在下载前明确失败；恢复正常预算复核缓存时全部字节数/哈希再次通过。

## 真实文档、结构与图片

样本由 ReportLab、python-docx、python-pptx、openpyxl 和 Pillow 生成，正文包含 `Fouc Knowledge Report`、容量表（Alpha/12/Ready、Beta/7/Review）和一个真实柱状图位图。不是以字符串或文件名匹配返回结果，也没有手写 PDF/Office 二进制。

遵循 PDF 技能，用 Poppler 渲染 PDF 并实际查看页面，标题、表格、图片与图注均可见、无重叠或裁切；另实际查看 HTTP 返回的提取 PNG。渲染图片只作为忽略目录中的 QA 中间文件，不是业务资产。

最终真实链路记录：**2026-09-26 06:30 UTC / 14:30 北京时间**，`.runtime/docling-verification.json`。

| 样本 | 字节数 | 实际解析结构 | 提取 PNG | 本轮 HTTP 耗时 |
| --- | --- | --- | --- | --- |
| PDF，有原生文本层 | 5,623 | 2 标题、1 表格、图注与图片位置 | 361×196，1,739 字节 | 9,781 ms |
| DOCX | 38,519 | 2 标题、1 表格、图注与图片位置 | 480×260，1,961 字节 | 5,235 ms |
| PPTX | 30,193 | 1 标题、1 表格、文本框与图片 | 同上 | 5,531 ms |
| XLSX | 7,522 | 3 表格（标题单元格、数据、图注）、图片 | 同上 | 5,047 ms |

Excel 的标题单元格保留为表格内容，未凭空改成 Word 标题层级。PDF 标题层级由实际模型输出，本样本两个标题均为二级，未声称复杂层级推断已经基准验收。

PDF 提取图片 SHA-256 为 `24eded23f87f1b6387831649fe5bc09d1c0c116ce491910daf270aee0d715aac`；三个 Office 容器取出的 PNG 与原图完全相同，SHA-256 为 `f43d6045dd28d693a052c7c860d92eb945bb0232ca87c67262c4234c2a1b22b0`。原文档的逐文件哈希位于 `.cache/documents/samples.json`，与验收 JSON 的 `assetHash` 对应。

返回示意（真实数据结构，不是识别替代品）：

```typescript
{
  derived: { status: 'ready', markdown: '... ![Image](asset:<PNG SHA-256>) ...' },
  attachments: [{ sha256, mime: 'image/png', size, width, height, dataBase64 }]
}
```

图片 base64 不进入 Markdown，也不写入 `asset.derived`；只有独立 HTTP 附件承载字节。验收 JSON 只记录附件元数据，没有把原始 base64 或凭据写入报告。Python 没有 S3 长期凭据、数据库或队列权限。

## 已验证的失败与资源边界

- **四种格式各自的空文档和损坏文档**：真实上传、真实 GET 下载后，分别返回 `422 empty_document` / `422 invalid_document`，均不可重试。八种情况全部通过。
- **整体期限**：1 ms 返回 `504 task_timeout`；明确只证明整体 HTTP deadline，不声称发生在模型推理阶段。同一 PDF 新 requestId 随后真正成功，耗时 9,702 ms。
- **取消**：调用方 200 ms abort，加服务端显式取消，返回 `task_cancelled`；继承且重跑 W01 的真实子进程/断连/关闭清理测试。
- **真实图像上限**：真实 DOCX/PNG 验证数量、解码像素、单图及多图聚合字节超限均明确失败；不会静默去掉图片。标准上限为 32 张、4 MP/张、单图及去重后总图各 1 MiB。
- **整体输出上限**：真实 Docling spawn 子进程解析含表格、图片及长正文的 DOCX，在 1 KiB 测试响应限额下返回 `413 result_too_large`，子进程结束，无活动子进程残留。生产整体 JSON 默认限额仍是 2 MiB。
- **容器/文档安全**：真实 PDF 页数/页面渲染像素；真实 OOXML 成员数/解压量、穿越路径、DTD/实体（包括 UTF-16）拒绝通过。
- **模型/运行环境**：缺缓存、存在但损坏的模型明确 `model_unavailable`；真实解析中禁止 Python 网络连接/DNS，禁用隐式 token 和远程服务，并关闭 LibreOffice 自动发现。
- **附件协议**：哈希、长度、PNG MIME/尺寸、base64、重复哈希、图片引用缺失或错配、禁止转写附带图片的严格检查均通过。

两轮完整文档 HTTP 验收各创建独立随机 `w03-verification/<UUID>/` 前缀，并在结束时**只删除各自 12 个测试 S3 对象**，均确认清理成功。Whisper 回归另清理其三个测试对象。模型、原始样本与无秘密证据继续保留于精确 gitignored `.cache/` / `.runtime/`，可重新生成。

## 回归与复现

- **56 项 Python 测试通过**；出现一条 Docling/Pydantic 默认 OCR 配置序列化的上游弃用警告，本实现并未设置被弃用的 `force_full_page_ocr`，且 OCR 关闭。
- **9 项客户端测试**在 Bun 和纯 Node 24 分别通过。
- 定向客户端严格 TypeScript 和 `pnpm backend:typecheck` 均通过；`pip check` 无依赖冲突。
- Whisper 真实 FLAC/MP4 回归成功，分段文本保持正确；新图片协议没有改变转写结果含义。
- 最终服务按 PID、可执行路径及命令行定向重启并真实 health/capabilities 验证；Next.js `http://localhost:3000/` HTTP 200，未重启或替换其 Web dev/HMR。

仓库根目录：

```powershell
.\services\media-worker\.venv\Scripts\python.exe -m pytest -q services/media-worker
bun test backend/src/knowledge/media/client.test.ts
pnpm backend:typecheck
.\services\media-worker\.venv\Scripts\python.exe services/media-worker/dev.py verify
bun build backend/src/knowledge/media/client.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.mjs
node services/media-worker/scripts/check-docling.mjs
node services/media-worker/scripts/check-whisper.mjs
bun build backend/src/knowledge/media/client.test.ts --target=node --format=esm --outfile services/media-worker/.runtime/client.test.mjs
node --test services/media-worker/.runtime/client.test.mjs
```

新环境先按 README 安装 venv 依赖，显式运行 `prepare_docling.py` / `prepare_documents.py`。模型准备阶段使用公开网络，**HTTP 解析阶段不下载模型**。没有重写根部服务配置或引入 Python 业务队列。

## 范围与后续责任

- **扫描 PDF 文字没有做 OCR**。仅图片的输出至多是可提取图片和图片引用，不代表已有可检索文字；没有伪造 OCR 开关或准确率。设计 §8.2 的图片描述/OCR 由 **W04 vision** 负责。
- **AS01/W05 才负责持久化闭环**：在源资产的同一 workspace 中校验并幂等写入附件 S3/asset；全部可用后才事务提交 derived、关联与 outbox。中途失败/取消必须防止悬空引用，对新建未引用对象做补偿/回收，不能删除已被复用对象。S3 与数据库不具备跨系统原子事务，不能把这项编排责任留给无状态 Python。
- W03 的 `asset:<hash>` 是待持久化引用，不宣称已经能在 UI 显示或已建立业务资产记录；附件字节不得混入索引或 AI 文本。
- 复杂表格、扫描 OCR、矢量/SmartArt/LibreOffice 图表渲染、各种语言与长文档准确率没有全面验收。无法提取的已检测图片明确失败，不返回假的图像。
- GPU、Linux/POSIX/Docker、OS 内存硬限制以及容器取消 race 仍须 Z03 验证；Windows 测试不等于 Linux 验收。Python 不自动重载，仍使用已验证的隐藏常驻进程方案。
