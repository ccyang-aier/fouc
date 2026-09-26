/**
 * O02 · Workspace / 成员 / 群组 / Teamspace 组织界面。
 *
 * 数据客户端与 hooks 一并从这里导出，供知识库应用接线（U02+）复用：
 * REST 路由见 backend/src/knowledge/organization/http.ts。
 */

export { OrganizationPanel } from './organization-panel';
export { organizationClient } from './client';
export type { OrganizationClient } from './client';
export { organizationQueryKeys } from './keys';
