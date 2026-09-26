# K02 验收 — MCP OAuth 2.1 与 PAT 授权

日期:2026-09-26 · 验收人:主会话 · 实现代理:K02 子代理 · 接线:主会话(runtime listener)

## 验收命令与结果

```
bun test backend/src/knowledge/auth backend/src/knowledge/mcp   # 99 pass / 0 fail / 1730 断言(11 文件)
cd backend && bunx tsc --noEmit                                  # 除并行在写的 ai/streaming 外 0 错误
```

实活验证(主会话在常驻 8711 运行时上接线后 curl):
- `GET /.well-known/oauth-protected-resource/api/knowledge/<ws>/mcp` → RFC 9728 元数据(resource/authorization_servers/scopes)✓
- `GET /.well-known/oauth-authorization-server/api/knowledge/<ws>/oauth` → RFC 8416 元数据(issuer/authorize/token/register/revoke)✓
- 未认证 MCP POST → `401 + WWW-Authenticate: Bearer resource_metadata=…`(RFC 9727)✓

## 交付内容

- `backend/src/knowledge/auth/oauth-server.ts`:OAuth 2.1 授权服务器引擎——RFC 7591 动态客户端注册(仅公共 PKCE 客户端)、授权端点(会话+工作区成员校验、HMAC 同意证明、5 分钟一次性 code、RFC 9207 iss)、令牌端点(code 原子认领、PKCE S256 常量时间、RFC 8707 resource 校验、签发标准 PAT 写入既有 personal_access_token 表)、RFC 7009 撤销(未知令牌恒 200)。
- `backend/src/knowledge/mcp/oauth.ts`:HTTP 路由 + PRM/AS 元数据 + WWW-Authenticate 助手;`mcp/server.ts` 认证段接入 oauth.externalOrigin(未认证挑战从 Bearer realm 升级为 resource_metadata)。
- `backend/src/api/knowledge/pat-routes.ts`:PAT 签发/列表/吊销专用路由(会话专属,tRPC 上下文不保留原始 Request 且 PAT 不得铸造 PAT)。
- `shared/src/knowledge/contracts/pat.ts`:PAT 契约上收单一事实源(access-policy/tokens 改别名导出,兼容保留)。
- 安全:全部比较常量时间;code/client_id/PAT secret ≥256-bit;逐请求查库吊销即时;redirect 仅 HTTPS/loopback(RFC 8252 端口可变);端点错误固定码脱敏。
- 接线(主会话):`runtime/server.ts` 挂载 PAT 路由、MCP OAuth 路由,`createKnowledgeMcpRequestHandler` 传入 `oauth.externalOrigin`;修复 MCP 分发正则未锚定行首导致 PRM 路径被截胡的缺陷;`api/knowledge/index.ts` 导出 `createKnowledgePatRoutes`。

## 验收标准核对(任务 acceptance 见台账)

- MCP OAuth 2.1:发现(PRM→AS)→注册→授权→PKCE 换 token→listTools 全链路集成测试 ✓(7 个端到端测试,真实 HTTP/PostgreSQL/Better Auth)
- PAT:签发/列表/吊销/撤销即时 401 ✓;OAuth 令牌与手工 PAT 同一验证路径 ✓
- RFC 9728/8416/7591/9207/8707/7009/9727 合规 ✓
