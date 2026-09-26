# U05 · 权限、继承与分享管理界面

日期:2026-09-26。模块:`src/features/knowledge/sharing/`(permission-model 纯模型、sharing-panel 组件)。

主代理实现并验证:页面权限面板——四级显式授权(主体 user/group/workspace,级别不超操作者有效级别)、继承开关(断开/恢复说明子树重算)、有效权限解释链(显式 > 断继承 > 根默认 > 继承)、分享链接创建/撤销(级别上限 comment、令牌仅创建时一次展示)。保存/失败反馈完整(busy/结构化错误中文映射/保留未保存态);非 edit+ 禁止全部写操作。面板经注入 api(SharingApi 接口)对接后端,Z03 装配路由后即真实往返,未装配时如实报错不伪造。

```powershell
bun test src/features/knowledge/sharing
pnpm typecheck
pnpm exec eslint --max-warnings=0 src/features/knowledge/sharing
node scripts/verify-knowledge-boundaries.mjs
```

**4 项测试/26 断言**;全仓类型 0 错误;lint 零告警;边界(291 文件)通过。

## 明确边界

页面 ACL/分享 HTTP 路由由 Z03 装配(SharingApi 五操作对接 P02 的 replaceAuthorizedPageAcl/setAuthorizedPageInheritance 与 P04 服务);成员/群组选择器复用 O02 组织面板(装配阶段);分享链接打开页(令牌消费 UI)属后续;面板挂载进页面详情/右侧栏随 Z03。
