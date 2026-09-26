# W05 验收 — 媒体派生任务编排与重索引

日期:2026-09-27 · 验收人:主会话(单人实现)

## 验收命令与结果

```
bun test backend/src/knowledge/workers/media.integration.test.ts   # 3 pass / 0 fail / 11 断言
cd backend && bunx tsc --noEmit                                      # media* 0 错误
bunx eslint --no-ignore backend/src/knowledge/workers/media*.ts     # 干净
```

真实链路:真实 MinIO 上传(AS01 prepare/confirm)、真实 graphile-worker 任务与 outbox 派发;媒体 HTTP 服务一 seam 之隔(W01-W03 已对真实服务验收,此处以客户端契约为界模拟响应)。

## 交付内容(backend/src/knowledge/workers/media.ts + media.integration.test.ts)

- `createAssetMediaConsumer({pool, storage, media})`:订阅 asset.created,audio/video 十一类 mime → transcribe,PDF/DOCX/PPTX/XLSX 四类 → parse_document(镜像服务端 contracts.py 集合);pending→processing→ready/failed 状态机与 W04 vision 同构,重放即 no-op(幂等)。
- 派生调用:服务端 presignDownload(600s)授予短期 GET,请求载荷带 sha256/size/mime;响应(严格经 mediaProcessResponseSchema 语义)写 asset.derived(model=processor,generatedAt)。
- 文档插图:附件按内容哈希成为同工作区资产(S3 PUT + asset 行 + asset.created 事件 → W04 vision 消费者接手描述/OCR);重复哈希 upsert no-op。
- 重索引:content_md 引用该资产哈希的 block_index 页面逐一获得 doc.changed outbox 事件(归因上传者),keyword(H01)与向量(H04)双消费者自动刷新 —— 派生文本随 AI 上下文进入索引,AI 工具(J02 read)同一通道可读。
- 失败:MediaWorkerError 按其 retryable 透传 —— 可重试的 rethrow 由队列退避重试,永久的写 derived.failed{error: 安全码} 且资产保持可查询。

## 验收标准核对

- graphile-worker 调用无状态 HTTP ✓(真实队列任务经 MediaWorkerClient)
- 幂等派生结果写库 ✓(重放测试:requests 不增、derived 不变)
- 索引引用块 ✓(引用页收到 doc.changed,probe 消费者断言)
- 图片/录音/PDF 可搜索且 AI 可读:转写/markdown 落 derived → doc.changed 重索引 → block_index 内容含派生文本(H01/H04 既有链路);插图成为资产并由 W04 继续派生 ✓

## 组装注记

生产 worker 的消费者装配(与 vision/events/rebuild 同列)属 Z03 组合根;本任务交付 `createAssetMediaConsumer` 工厂与 `MEDIA_WORKER_URL` 既有配置位。
