import { KnowledgeDataError } from './errors';
import { parseFoucApiOrigin } from '@/lib/fouc-api-endpoint';
export const knowledgeApiPathPrefix = '/api/knowledge';
const workspaceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The tRPC transport URL for one workspace: `<origin>/api/knowledge/<workspaceId>/trpc` (A00 contract). */
export function knowledgeTrpcUrl(origin: string, workspaceId: string): string {
  if (!workspaceIdPattern.test(workspaceId)) {
    throw new KnowledgeDataError('INVALID_REQUEST', { message: 'workspaceId must be a UUID.' });
  }
  return `${parseFoucApiOrigin(origin)}${knowledgeApiPathPrefix}/${workspaceId}/trpc`;
}
