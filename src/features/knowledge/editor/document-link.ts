export type DocumentLinkTarget = { workspaceId: string; knowledgeBaseId: string; pageId: string; source: 'local' | 'workspace' };

export function documentLink(location: string, target: DocumentLinkTarget): string {
  const url = new URL('/', location);
  url.searchParams.set('view', 'knowledge');
  url.searchParams.set('document', target.pageId);
  url.searchParams.set('workspace', target.workspaceId);
  url.searchParams.set('knowledgeBase', target.knowledgeBaseId);
  url.searchParams.set('source', target.source);
  return url.href;
}
export function readDocumentLink(location: string): DocumentLinkTarget | null {
  const params = new URL(location).searchParams;
  const pageId = params.get('document');
  const workspaceId = params.get('workspace');
  const knowledgeBaseId = params.get('knowledgeBase');
  const source = params.get('source');
  return pageId && workspaceId && knowledgeBaseId && (source === 'local' || source === 'workspace')
    ? { pageId, workspaceId, knowledgeBaseId, source } : null;
}

export function currentDocumentLinkTarget(workspaceId: string, source: DocumentLinkTarget['source']) {
  const target = typeof window === 'undefined' ? null : readDocumentLink(window.location.href);
  return target?.workspaceId === workspaceId && target.source === source ? target : null;
}
