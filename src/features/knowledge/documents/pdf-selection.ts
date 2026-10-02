import type { PdfCommentAnchor } from '@fouc/shared/knowledge/contracts';
export type PdfRect = PdfCommentAnchor['pages'][number]['rects'][number];
export function normalizePdfRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>, page: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>): PdfRect | null {
  const left = Math.max(rect.left, page.left), top = Math.max(rect.top, page.top);
  const right = Math.min(rect.right, page.right), bottom = Math.min(rect.bottom, page.bottom);
  if (right - left < 1 || bottom - top < 1 || !page.width || !page.height) return null;
  return { x: (left - page.left) / page.width, y: (top - page.top) / page.height, width: (right - left) / page.width, height: (bottom - top) / page.height };
}
/** TextLayer can report parent and child rectangles; coalesce each line. */
export function mergePdfRects(rects: PdfRect[]): PdfRect[] {
  const result: PdfRect[] = [];
  for (const rect of rects.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const previous = result.find(item => Math.abs(item.y - rect.y) < .003 && Math.abs(item.height - rect.height) < .004 && rect.x <= item.x + item.width + .004 && rect.x + rect.width >= item.x);
    if (previous) { const right = Math.max(previous.x + previous.width, rect.x + rect.width); previous.x = Math.min(previous.x, rect.x); previous.width = right - previous.x; }
    else result.push({ ...rect });
  }
  return result;
}
export function readPdfSelection(host: HTMLElement, assetHash: string): { anchor: PdfCommentAnchor; x: number; y: number } | null {
  const selection = host.ownerDocument.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount || !selection.anchorNode || !selection.focusNode) return null;
  const textLayer = (node: Node) => (node.nodeType === 1 ? node as Element : node.parentElement)?.closest('[data-pdf-text]');
  if (!host.contains(textLayer(selection.anchorNode) ?? null) || !host.contains(textLayer(selection.focusNode) ?? null)) return null;
  const quote = selection.toString().trim();
  if (!quote || quote.length > 50_000) return null;
  const range = selection.getRangeAt(0);
  let lastRect: DOMRect | undefined;
  const pages: PdfCommentAnchor['pages'] = [];
  for (const element of host.querySelectorAll<HTMLElement>('[data-pdf-page]')) {
    const text = element.querySelector('[data-pdf-text]');
    if (!text || !range.intersectsNode(text)) continue;
    // Clip to the text layer so a cross-page selection never includes canvas,
    // page containers or annotation badges in its persisted highlight geometry.
    const contents = host.ownerDocument.createRange(); contents.selectNodeContents(text);
    const fragment = range.cloneRange();
    if (range.compareBoundaryPoints(range.START_TO_START, contents) < 0) fragment.setStart(contents.startContainer, contents.startOffset);
    if (range.compareBoundaryPoints(range.END_TO_END, contents) > 0) fragment.setEnd(contents.endContainer, contents.endOffset);
    const clientRects = [...fragment.getClientRects()];
    lastRect = clientRects.at(-1) ?? lastRect;
    const bounds = element.getBoundingClientRect();
    const rects = mergePdfRects(clientRects.map(rect => normalizePdfRect(rect, bounds)).filter((rect): rect is PdfRect => rect !== null));
    if (rects.length && rects.length <= 200) pages.push({ page: Number(element.dataset.pdfPage), rects });
  }
  if (!pages.length || pages.length > 32) return null;
  const rect = lastRect!;
  return { anchor: { assetHash, quote, pages }, x: (rect.left + rect.right) / 2, y: rect.bottom };
}
