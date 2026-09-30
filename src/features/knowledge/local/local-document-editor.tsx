'use client';

import { useMemo } from 'react';
import { Extension } from '@tiptap/core';
import { useEditor } from '@tiptap/react';
import { history, redo, undo } from '@tiptap/pm/history';
import { createBlockIdExtension, createKnowledgeExtensions } from '@fouc/shared/knowledge/schema';
import { applyEditorBlockModules } from '../editor/block-modules';
import { createSlashPasteExtensions, SlashMenuLayer } from '../editor/commands';
import { DocumentEditorBody, DocumentEditorFrame, DocumentHeading } from '../editor/editor-layout';
import { DocumentEditorHeader } from '../editor/components/document-editor-header';
import { createBlockEditingExtensions } from '../editor/extensions';
import { TaskProgress } from '../editor/block-modules/task-list/task-progress';
import type { LocalDocument } from './local-library';
import type { createLocalLibraryStore } from './local-library';

const localHistory = Extension.create({
  name: 'localHistory',
  addProseMirrorPlugins: () => [history()],
  addKeyboardShortcuts() {
    return {
      'Mod-z': () => undo(this.editor.state, this.editor.view.dispatch),
      'Mod-Shift-z': () => redo(this.editor.state, this.editor.view.dispatch),
      'Mod-y': () => redo(this.editor.state, this.editor.view.dispatch),
    };
  },
});

export function LocalDocumentEditor({ workspaceId, store, document, collectionName, onChange, onBack, onToggleSidebar, onCreateDocument }: { workspaceId: string; store: ReturnType<typeof createLocalLibraryStore>; document: LocalDocument; collectionName: string; onChange: (patch: Partial<LocalDocument>) => boolean; onBack: () => void; onToggleSidebar: () => void; onCreateDocument: () => void }) {
  const extensions = useMemo(() => [
    ...applyEditorBlockModules(createKnowledgeExtensions(), {
      localWorkspaceId: workspaceId,
      localPageId: document.id,
      getLocalPages: () => store.getSnapshot().documents.filter((item) => item.baseId === document.baseId && !item.deleted),
      subscribeLocalPages: store.subscribe,
    }),
    createBlockIdExtension({ pageId: document.id }),
    ...createBlockEditingExtensions(),
    ...createSlashPasteExtensions(),
    localHistory,
  ], [document.id, document.baseId, workspaceId, store]);
  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    content: document.body,
    editorProps: { attributes: { 'aria-label': '页面正文' } },
    onUpdate: ({ editor: current }) => onChange({ body: current.getJSON() }),
  }, [extensions]);

  return <DocumentEditorFrame appearanceScope={`local:${workspaceId}:${document.id}`}>
    <DocumentEditorHeader
      editor={editor}
      collectionName={collectionName}
      title={document.title}
      avatarName="我"
      starred={document.starred}
      onBack={onBack}
      onToggleSidebar={onToggleSidebar}
      onToggleStar={() => onChange({ starred: !document.starred })}
      onCreateDocument={onCreateDocument}
      shareDescription="本机文档仅保存在当前浏览器。你可以复制标题和正文，通过其他应用分享。"
      menuActions={{ target: { workspaceId, knowledgeBaseId: document.baseId, pageId: document.id, source: 'local' }, onDelete: () => { if (!onChange({ deleted: true })) throw new Error('save-failed'); onBack(); } }}
    />
    <DocumentEditorBody editor={editor} before={<DocumentHeading
      title={document.title}
      onTitleChange={(title) => onChange({ title })}
      metadata={<>
        <span>你已更新 · 保存在本机</span>
        <TaskProgress editor={editor} />
        <span>已被浏览 仅你自己</span>
      </>}
    />} />
    <SlashMenuLayer editor={editor} />
  </DocumentEditorFrame>;
}
