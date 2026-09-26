/**
 * The page editor feature (E03): the Tiptap React container, its Client
 * Boundary and the pure view-model logic. Wiring point for the shell —
 *
 * ```tsx
 * import { KnowledgePageEditor } from '@/features/knowledge/editor';
 *
 * selectedPage ? <KnowledgePageEditor scope={{ workspaceId, pageId }} /> : <WorkspaceCanvas … />
 * ```
 *
 * — the component owns the whole access / session / sync / readonly loop, so
 * the shell only supplies the page scope.
 */

export { KnowledgePageEditor } from './editor-boundary';
export { editorClientBoundary } from './editor-boundary-options';
export { derivePageEditorView, levelSatisfies, pageEditorGateOf, permissionLevelLabel, syncIndicatorView } from './editor-state';
export type { PageEditorGate, PageEditorViewModel, ReadonlyReason, SyncBadge, SyncIndicatorView, SyncTone } from './editor-state';
