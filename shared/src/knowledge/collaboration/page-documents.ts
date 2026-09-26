import { entityIdSchema } from '../contracts';
import type { PageScope } from '../contracts';

const prefix = 'page:';

/**
 * Page documents are the only names the collaboration server accepts
 * (B01's upgrade gate); workspace event channels and any other namespace are
 * rejected. The single source of this format lives here so the web client
 * (B04) and the server assembly name identical documents.
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
