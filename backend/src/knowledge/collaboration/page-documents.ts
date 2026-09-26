import { entityIdSchema } from '@fouc/shared/knowledge/contracts';
import type { PageScope } from '@fouc/shared/knowledge/contracts';

const prefix = 'page:';

/**
 * Page documents are the only names this server accepts. Workspace event
 * channels (B06) and any other namespace are rejected at the upgrade gate.
 */
export function pageDocumentName(scope: PageScope): string {
  return `${prefix}${scope.workspaceId}:${scope.pageId}`;
}

export function parsePageDocument(documentName: string): PageScope | undefined {
  if (!documentName.startsWith(prefix)) return undefined;
  const separator = documentName.indexOf(':', prefix.length);
  if (separator < 0) return undefined;
  const workspaceId = documentName.slice(prefix.length, separator);
  const pageId = documentName.slice(separator + 1);
  if (entityIdSchema.safeParse(workspaceId).success && entityIdSchema.safeParse(pageId).success) {
    return { workspaceId, pageId };
  }
  return undefined;
}
