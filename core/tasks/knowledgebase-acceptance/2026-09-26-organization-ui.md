# O02 · Workspace/成员/Teamspace 组织界面

日期：2026-09-26。模块：`src/features/knowledge/organization/`（client/hooks/keys/errors/view-model/list-mutations/ui/workspace-bar/members-section/groups-section/teamspaces-section/organization-panel）。实现代理完成开发后被中断；主代理复验、归档视觉证据并清理了开发用 preview 脚手架（截图留存于 `organization-ui-previews/`）。

```powershell
bun test src/features/knowledge/organization
pnpm exec eslint --max-warnings=0 src/features/knowledge/organization
pnpm typecheck
node scripts/verify-knowledge-boundaries.mjs
```

**32 tests / 0 fail / 160 assertions**；lint 零告警；根类型检查零错误；架构边界（225 文件）通过。13 张状态截图（成员就绪/空间切换/群组面板/Teamspace/权限重算提示/创建空间/移除确认/回滚与成功 toast/空·错误·无权·未认证四态）由实现代理经静态预览实测产出，归档在 `core/tasks/knowledgebase-acceptance/organization-ui-previews/`。

## 通过的实际流程（逐条对应验收标准）

- **空间创建、切换、成员/群组管理闭环**：组织客户端走真实后端路由契约（`backend/src/knowledge/organization/http.ts` 的端点/输入/错误码映射为类型化调用）；workspace 列表/创建/切换、成员角色变更/移除、群组增删改与成员管理、Teamspace 创建/改名/根默认权限（四级+null）全部成面板操作。
- **空/加载/无权/失败状态清晰**：列表四态渲染逻辑经 view-model 测试覆盖；结构化错误码→中文文案；乐观更新+失败回滚+成功/回滚 toast（list-mutations 测试）。
- **根默认权限生效提示**：defaultAccess 变更面板带权限重算确认与说明文案（P02 语义：非空空间立即失效重建），截图 05 留证。
- 数据层遵循 U01 模式（endpoint 解析、错误归一、workspace 键隔离），未另建第二套客户端约定。

## 明确边界

8710 sidecar 未挂载组织路由（Z03 装配），本项验收以路由契约映射+状态机单测+静态预览视觉证据为准，未含真实 HTTP 往返；面板挂载进应用壳随 U02；邀请令牌链接化 UI 属后续任务。截图为开发预览渲染，最终视觉随 U02 三栏壳层统一打磨。
