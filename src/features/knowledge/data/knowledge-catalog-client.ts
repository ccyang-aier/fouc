import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';
import type { KnowledgeBase, Teamspace } from '@fouc/shared/knowledge/contracts';
import {
  createOrganizationRequest,
  listQuery,
  requireName,
  requireUuid,
  type OrganizationClientDeps,
  type OrganizationListOptions,
  type OrganizationPage,
  type RemovedResult,
} from '@/features/workspaces/organization-client';
import { OrganizationDataError } from '@/features/workspaces/organization-errors';

export type TeamspaceAccess = Teamspace['defaultAccess'];
export type TeamspacePatch = { name?: string; defaultAccess?: TeamspaceAccess };
export const teamspaceAccessValues: readonly NonNullable<TeamspaceAccess>[] = ['view', 'comment', 'edit', 'full'];

function requireAccess(value: TeamspaceAccess): TeamspaceAccess {
  if (value !== null && !teamspaceAccessValues.includes(value)) {
    throw new OrganizationDataError('INVALID_INPUT', { message: '未知的默认权限级别' });
  }
  return value;
}

export function createKnowledgeCatalogClient(deps: OrganizationClientDeps) {
  const request = createOrganizationRequest(deps);
  return {
    listKnowledgeBases(workspaceId: string, options: OrganizationListOptions = {}) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      return request<OrganizationPage<KnowledgeBase>>({ method: 'GET', path: `/api/workspaces/${scope}/knowledge-bases`, query: listQuery(options), signal: options.signal });
    },
    createKnowledgeBase(workspaceId: string, input: { name: string }) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      return request<KnowledgeBase>({ method: 'POST', path: `/api/workspaces/${scope}/knowledge-bases`, body: { name: requireName(input.name) } });
    },
    listTeamspaces(workspaceId: string, options: OrganizationListOptions & { knowledgeBaseId?: string } = {}) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      return request<OrganizationPage<Teamspace>>({ method: 'GET', path: `/api/workspaces/${scope}/teamspaces`, query: { ...listQuery(options), knowledgeBaseId: options.knowledgeBaseId ? requireUuid(options.knowledgeBaseId, 'knowledgeBaseId') : undefined }, signal: options.signal });
    },
    createTeamspace(workspaceId: string, input: { knowledgeBaseId: string; name: string; defaultAccess: TeamspaceAccess }) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      return request<Teamspace>({ method: 'POST', path: `/api/workspaces/${scope}/teamspaces`, body: { knowledgeBaseId: requireUuid(input.knowledgeBaseId, 'knowledgeBaseId'), name: requireName(input.name), defaultAccess: requireAccess(input.defaultAccess) } });
    },
    updateTeamspace(workspaceId: string, teamspaceId: string, patch: TeamspacePatch) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const target = requireUuid(teamspaceId, 'teamspaceId');
      if (patch.name === undefined && patch.defaultAccess === undefined) {
        throw new OrganizationDataError('INVALID_INPUT', { message: '至少提供 name 或 defaultAccess 之一' });
      }
      const body: TeamspacePatch = {};
      if (patch.name !== undefined) body.name = requireName(patch.name);
      if (patch.defaultAccess !== undefined) body.defaultAccess = requireAccess(patch.defaultAccess);
      return request<Teamspace>({ method: 'PATCH', path: `/api/workspaces/${scope}/teamspaces/${target}`, body });
    },
    removeTeamspace(workspaceId: string, teamspaceId: string) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const target = requireUuid(teamspaceId, 'teamspaceId');
      return request<RemovedResult>({ method: 'DELETE', path: `/api/workspaces/${scope}/teamspaces/${target}`, body: {} });
    },
  };
}

export const knowledgeCatalogClient = createKnowledgeCatalogClient({
  origin: async () => (await getFoucApiOrigin()).origin,
  fetchImpl: authenticatedFetch,
});
