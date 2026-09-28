# 知识库目录

本模块只管理工作空间内的知识库与文件夹（现有内部实体名 `teamspace`），不管理工作空间、成员、群组或项目。工作空间公共能力见[工作空间实现](workspaces.md)，项目见[项目实现](projects.md)。

`createKnowledgeCatalogService(pool)` 按已认证主体及当前工作空间校验操作权限。知识库含独立 ID 和必填 `workspaceId`；文件夹含必填 `knowledgeBaseId`。数据库复合外键要求文件夹与知识库同处一个工作空间，强制 RLS 限定所有业务表的空间范围。创建知识库时，同一事务创建初始文件夹；创建文件夹不会创建知识库或切换工作空间。

HTTP 路由仍使用统一资源路径 `/api/workspaces/:workspaceId/knowledge-bases` 与 `/api/workspaces/:workspaceId/teamspaces`。路径表达资源作用域，并不表示这些用例归工作空间服务所有。知识库列表只列出当前工作空间的知识库；文件夹列表可再按 `knowledgeBaseId` 过滤。页面、编辑、搜索与权限用例位于知识库的其他子模块。

文件夹默认权限的更改必须经过权限重建约束。已含页面且默认权限实际变化时，目前返回 `TEAMSPACE_DEFAULT_ACCESS_REQUIRES_REBUILD`；删除非空文件夹返回 `TEAMSPACE_NOT_EMPTY`。不能以删除级联代替显式内容操作。

验证：`bun test backend/server/src/modules/knowledge/organization`，并运行 `pnpm server:typecheck`。
