# 项目服务

项目是工作空间下的独立一级资源，与知识库同级。`createProjectService(pool)` 提供当前空间的列表、创建、重命名与删除；项目 ID 与工作空间 ID 一起定位资源，所有操作验证当前用户的空间成员资格，写操作要求管理权限。项目不会因名称或选择状态与知识库建立包含关系。

HTTP 路径为 `/api/workspaces/:workspaceId/projects`。前端的项目列表与当前选择由 `src/features/project/project-resources.tsx` 持有，shell 只组合并呈现模块。当前项目首页的详细任务、对话等演示内容仅属于开发样例项目；新增项目显示空项目状态，不复制样例内容。

验证：`bun test backend/server/src/modules/projects`，并运行 `pnpm server:typecheck`。
