/**
 * Organization REST client (O02).
 *
 * The organization service is a plain Hono REST surface under
 * `/api/knowledge/workspaces` — not the workspace-scoped tRPC transport of U01 —
 * so this module owns its own endpoint mapping while reusing the U01 endpoint
 * resolver (`getFoucApiOrigin`) and following the same error-normalization
 * pattern. Contract: mutations send `application/json` bodies; DELETE requests
 * carry an empty `{}` body because the route middleware demands JSON on every
 * non-GET request; list endpoints paginate by UUID cursor.
 */

import { authenticatedFetch } from '@/lib/authenticated-fetch';
import type {
  Group,
  MemberRole,
  Teamspace,
  Workspace,
  WorkspaceMemberSummary,
} from '@fouc/shared/knowledge/contracts';
import { knowledgeApiPathPrefix } from '../data/endpoint';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';
import { OrganizationDataError, normalizeOrganizationError, organizationErrorFromBody } from './errors';

export type { Group, MemberRole, Teamspace, Workspace, WorkspaceMemberSummary };
/** Backend row of `group_member`: identity only; names resolve against the member directory. */
export type GroupMemberRow = { workspaceId: string; groupId: string; userId: string };

export type WorkspaceWithRole = Workspace & { role: MemberRole };
export type MemberRecord = Pick<WorkspaceMemberSummary, 'workspaceId' | 'userId' | 'role'>;
export type OrganizationPage<T> = { items: T[]; nextCursor: string | null };
export type RemovedResult = { removed: true };
export type TeamspaceAccess = Teamspace['defaultAccess'];
export type TeamspacePatch = { name?: string; defaultAccess?: TeamspaceAccess };
export type GroupMember = GroupMemberRow;

export const memberRoles: readonly MemberRole[] = ['owner', 'admin', 'member', 'guest'];
export const workspaceKinds: readonly Workspace['kind'][] = ['personal', 'team'];
export const teamspaceAccessValues: readonly NonNullable<TeamspaceAccess>[] = ['view', 'comment', 'edit', 'full'];

const organizationPathPrefix = `${knowledgeApiPathPrefix}/workspaces`;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mirrors the shared `name` contract (`trim + 1..120 chars`) before any request is sent. */
export function validateOrganizationName(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, reason: '名称不能为空' };
  if (value.length > 120) return { ok: false, reason: '名称不能超过 120 个字符' };
  return { ok: true, value };
}

function requireUuid(value: string, field: string): string {
  if (!uuidPattern.test(value)) throw new OrganizationDataError('INVALID_INPUT', { message: `${field} 必须是 UUID` });
  return value;
}

function requireName(value: string): string {
  const parsed = validateOrganizationName(value);
  if (!parsed.ok) throw new OrganizationDataError('INVALID_INPUT', { message: parsed.reason });
  return parsed.value;
}

function requireRole(value: MemberRole): MemberRole {
  if (!memberRoles.includes(value)) throw new OrganizationDataError('INVALID_INPUT', { message: '未知成员角色' });
  return value;
}

function requireAccess(value: TeamspaceAccess): TeamspaceAccess {
  if (value !== null && !teamspaceAccessValues.includes(value)) {
    throw new OrganizationDataError('INVALID_INPUT', { message: '未知的默认权限级别' });
  }
  return value;
}

export type OrganizationListOptions = { cursor?: string | null; limit?: number; signal?: AbortSignal };

export type OrganizationClientDeps = {
  /** Resolved API origin (the U01 resolver in the browser binding). */
  origin: () => Promise<string>;
  fetchImpl: typeof fetch;
};

type RequestOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
};

function buildUrl(origin: string, request: RequestOptions): string {
  const url = new URL(`${origin}${request.path}`);
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function createOrganizationClient(deps: OrganizationClientDeps) {
  async function request<T>(request: RequestOptions): Promise<T> {
    let origin: string;
    try {
      origin = await deps.origin();
    } catch (cause) {
      throw normalizeOrganizationError(cause, request.signal);
    }
    // DELETE carries `{}`: the route middleware requires a JSON body on every non-GET request.
    const hasBody = request.method !== 'GET';
    let response: Response;
    try {
      response = await deps.fetchImpl(buildUrl(origin, request), {
        method: request.method,
        headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
        body: hasBody ? JSON.stringify(request.body ?? {}) : undefined,
        credentials: 'include',
        signal: request.signal,
      });
    } catch (cause) {
      throw normalizeOrganizationError(cause, request.signal);
    }
    if (response.ok) {
      try {
        return await response.json() as T;
      } catch (cause) {
        throw normalizeOrganizationError(new OrganizationDataError('ORGANIZATION_UNAVAILABLE', { httpStatus: response.status, cause }), request.signal);
      }
    }
    const body = await response.json().catch(() => null);
    throw normalizeOrganizationError(organizationErrorFromBody(response.status, body), request.signal);
  }

  function listQuery(options: OrganizationListOptions): Record<string, string | number | undefined> {
    if (options.cursor !== undefined && options.cursor !== null && !uuidPattern.test(options.cursor)) {
      throw new OrganizationDataError('INVALID_INPUT', { message: 'cursor 必须是 UUID' });
    }
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100)) {
      throw new OrganizationDataError('INVALID_INPUT', { message: 'limit 必须是 1..100 的整数' });
    }
    return { cursor: options.cursor ?? undefined, limit: options.limit };
  }

  return {
    listWorkspaces(options: OrganizationListOptions = {}) {
      return request<OrganizationPage<WorkspaceWithRole>>({ method: 'GET', path: organizationPathPrefix, query: listQuery(options), signal: options.signal });
    },
    createWorkspace(input: { name: string; kind: Workspace['kind'] }) {
      const kind = workspaceKinds.includes(input.kind) ? input.kind : undefined;
      if (!kind) throw new OrganizationDataError('INVALID_INPUT', { message: '未知工作区类型' });
      return request<WorkspaceWithRole>({ method: 'POST', path: organizationPathPrefix, body: { name: requireName(input.name), kind } });
    },
    listMembers(workspaceId: string, options: OrganizationListOptions = {}) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      return request<OrganizationPage<WorkspaceMemberSummary>>({ method: 'GET', path: `${organizationPathPrefix}/${scope}/members`, query: listQuery(options), signal: options.signal });
    },
    changeMemberRole(workspaceId: string, input: { userId: string; role: MemberRole }) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const userId = requireUuid(input.userId, 'userId');
      return request<MemberRecord>({ method: 'PATCH', path: `${organizationPathPrefix}/${scope}/members/${userId}`, body: { role: requireRole(input.role) } });
    },
    removeMember(workspaceId: string, userId: string) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const target = requireUuid(userId, 'userId');
      return request<RemovedResult>({ method: 'DELETE', path: `${organizationPathPrefix}/${scope}/members/${target}`, body: {} });
    },
    listGroups(workspaceId: string, options: OrganizationListOptions = {}) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      return request<OrganizationPage<Group>>({ method: 'GET', path: `${organizationPathPrefix}/${scope}/groups`, query: listQuery(options), signal: options.signal });
    },
    createGroup(workspaceId: string, input: { name: string }) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      return request<Group>({ method: 'POST', path: `${organizationPathPrefix}/${scope}/groups`, body: { name: requireName(input.name) } });
    },
    renameGroup(workspaceId: string, input: { id: string; name: string }) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const id = requireUuid(input.id, 'groupId');
      return request<Group>({ method: 'PATCH', path: `${organizationPathPrefix}/${scope}/groups/${id}`, body: { name: requireName(input.name) } });
    },
    removeGroup(workspaceId: string, groupId: string) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const target = requireUuid(groupId, 'groupId');
      return request<RemovedResult>({ method: 'DELETE', path: `${organizationPathPrefix}/${scope}/groups/${target}`, body: {} });
    },
    listGroupMembers(workspaceId: string, groupId: string, options: OrganizationListOptions = {}) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const target = requireUuid(groupId, 'groupId');
      return request<OrganizationPage<GroupMember>>({ method: 'GET', path: `${organizationPathPrefix}/${scope}/groups/${target}/members`, query: listQuery(options), signal: options.signal });
    },
    addGroupMember(workspaceId: string, groupId: string, userId: string) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const group = requireUuid(groupId, 'groupId');
      const member = requireUuid(userId, 'userId');
      return request<GroupMember>({ method: 'POST', path: `${organizationPathPrefix}/${scope}/groups/${group}/members`, body: { userId: member } });
    },
    removeGroupMember(workspaceId: string, groupId: string, userId: string) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const group = requireUuid(groupId, 'groupId');
      const member = requireUuid(userId, 'userId');
      return request<RemovedResult>({ method: 'DELETE', path: `${organizationPathPrefix}/${scope}/groups/${group}/members/${member}`, body: {} });
    },
    listTeamspaces(workspaceId: string, options: OrganizationListOptions = {}) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      return request<OrganizationPage<Teamspace>>({ method: 'GET', path: `${organizationPathPrefix}/${scope}/teamspaces`, query: listQuery(options), signal: options.signal });
    },
    createTeamspace(workspaceId: string, input: { name: string; defaultAccess: TeamspaceAccess }) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      return request<Teamspace>({ method: 'POST', path: `${organizationPathPrefix}/${scope}/teamspaces`, body: { name: requireName(input.name), defaultAccess: requireAccess(input.defaultAccess) } });
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
      return request<Teamspace>({ method: 'PATCH', path: `${organizationPathPrefix}/${scope}/teamspaces/${target}`, body });
    },
    removeTeamspace(workspaceId: string, teamspaceId: string) {
      const scope = requireUuid(workspaceId, 'workspaceId');
      const target = requireUuid(teamspaceId, 'teamspaceId');
      return request<RemovedResult>({ method: 'DELETE', path: `${organizationPathPrefix}/${scope}/teamspaces/${target}`, body: {} });
    },
  };
}

export type OrganizationClient = ReturnType<typeof createOrganizationClient>;

/** Browser binding: the same origin resolver as the tRPC transport; cookies are the credential. */
export const organizationClient: OrganizationClient = createOrganizationClient({
  origin: async () => (await getFoucApiOrigin()).origin,
  fetchImpl: authenticatedFetch,
});
