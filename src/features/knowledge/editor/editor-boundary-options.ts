/**
 * The Client Boundary descriptor of the editor (E03).
 *
 * The editor surface — Tiptap, ProseMirror, y-prosemirror and the page
 * session — must never render on the server and must stay out of the
 * first-screen bundle. `editor-boundary.tsx` consumes this descriptor for its
 * `next/dynamic` call, so the flag is one named, testable fact instead of a
 * buried option.
 */
export const editorClientBoundary = {
  /** No server-side rendering: the Tiptap view is created strictly after mount. */
  ssr: false,
  /** `role="status"` copy of the fallback while the editor chunk streams in. */
  loadingLabel: '正在加载编辑器',
} as const;
