import { projectSchema, type Project } from '@fouc/shared/projects';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';

type ProjectPage = { items: Project[]; nextCursor: string | null };

async function request<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown, signal?: AbortSignal): Promise<T> {
  const { origin } = await getFoucApiOrigin();
  const response = await authenticatedFetch(`${origin}/api/workspaces/${path}`, {
    method, signal, ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string' ? payload.message : '项目服务暂不可用');
  return payload as T;
}

export const projectClient = {
  async list(workspaceId: string, signal?: AbortSignal) {
    const items: Project[] = [];
    let cursor: string | null = null;
    do {
      const page: ProjectPage = await request(`${workspaceId}/projects${cursor ? `?cursor=${cursor}` : ''}`, 'GET', undefined, signal);
      items.push(...page.items.map((item) => projectSchema.parse(item)));
      cursor = page.nextCursor;
    } while (cursor);
    return items;
  },
  async create(workspaceId: string, name: string) {
    return projectSchema.parse(await request(`${workspaceId}/projects`, 'POST', { name }));
  },
  async rename(workspaceId: string, projectId: string, name: string) {
    return projectSchema.parse(await request(`${workspaceId}/projects/${projectId}`, 'PATCH', { name }));
  },
  async remove(workspaceId: string, projectId: string) {
    await request(`${workspaceId}/projects/${projectId}`, 'DELETE');
  },
};
