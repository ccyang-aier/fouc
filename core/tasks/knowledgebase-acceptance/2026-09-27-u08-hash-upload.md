# U08 验收 — 浏览器哈希上传与进度控制

日期:2026-09-27 · 验收人:主会话 · 实现代理:U08 子代理(全量实现)

## 验收命令与结果

```
bun test src/features/knowledge/assets                        # 53 pass / 0 fail / 242 断言(5 文件)
bunx eslint --no-ignore src/features/knowledge/assets         # 0 错误 0 警告
node scripts/verify-knowledge-boundaries.mjs                  # 375 文件通过
```

真实链路:MinIO 集成测试以 AS01 presign 函数铸真 SigV4 预签名 URL,PUT→GET 回读复哈希→done;秒传分支实测。tRPC 未挂载的 asset.prepare/confirm 按既有模式诚实 NOT_FOUND。

## 交付内容(src/features/knowledge/assets/ 14 文件)

- `sha256.ts`:FIPS 180-4 增量 SHA-256(WebCrypto 无法流式),File.stream() 逐块喂入,内存峰值与文件大小无关;NIST 向量+任意切分跨块边界测试。
- `assets-api.ts`/`transfer.ts`:asset.prepare/confirm 走 untyped tRPC + 共享 zod 契约复验;直传 XHR(upload.onprogress 进度、abort 取消),义务请求头原样使用。
- `upload-machine.ts`:单文件流水线 hashing→preparing→uploading→confirming→done/error/canceled;统一 AbortController(哈希流/tRPC/XHR 同信号);重试从 error/canceled 出发且哈希复用不重算、重新 prepare 探测。
- `use-asset-uploads.ts` + `components/`:AssetUploader 拖拽/点选、类型图标、字节进度条(不确定相位脉冲)、成功态(指纹+秒传标记)、错误态(原因+重试)、取消/重试/移除/清除终态;onUploaded 回调为编辑器媒体块插入挂点。

## 验收标准核对

- 浏览器 SHA-256 ✓(流式,16 MiB 与 Node crypto 一致);预签名直传 ✓(真实 MinIO);完整性确认闭环 ✓(客户端回读复哈希+服务端 AS01 校验)
- 秒传 ✓;进度/取消/重试/错误反馈 ✓(状态机与组件测试全覆盖)
- 通过真实后端与 S3 验证 ✓(MinIO 集成 2 项;tRPC 路由装配缺口已记录,属路由挂载任务)

## 后端缺口(记录)

router.ts 需挂 asset.prepare/asset.confirm(调用已验收的 prepareWorkspaceAssetUpload/confirmWorkspaceAssetUpload),随路由装配任务合入。
