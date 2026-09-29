'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowSquareOut, Link, PencilSimple } from '@phosphor-icons/react';
import { DOMSerializer } from '@tiptap/pm/model';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Extensions } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { withNodeView } from '../../extensions/with-node-view';
import { requestOpenPageBlock } from '../../open-target';
import type { EditorBlockContext } from '../types';
import { BlockReferencePicker, listReferenceBlocks } from './block-reference-picker';
import styles from './block-reference.module.css';

type LocalContext = Required<Pick<EditorBlockContext, 'localWorkspaceId' | 'localPageId' | 'getLocalPages' | 'subscribeLocalPages'>>;

export function applyLocalBlockReferenceView(extensions: Extensions, context: LocalContext): Extensions {
  return withNodeView(extensions, 'blockReference', () => ReactNodeViewRenderer((props) => <LocalBlockReferenceCard {...props} context={context} />));
}

function findBlock(root: ProseMirrorNode, id: string): ProseMirrorNode | null {
  let found: ProseMirrorNode | null = null;
  root.descendants((node) => { if (!found && node.attrs.blockId === id) found = node; });
  return found;
}

function LocalBlockReferenceCard({ context, node, editor, updateAttributes, HTMLAttributes }: NodeViewProps & { context: LocalContext }) {
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const contentHost = useRef<HTMLDivElement | null>(null);
  useEffect(() => context.subscribeLocalPages(() => setRevision((value) => value + 1)), [context]);
  const pageId = String(node.attrs.pageId || '');
  const targetBlockId = String(node.attrs.targetBlockId || '');
  const pages = context.getLocalPages();
  const sourcePage = pages.find((page) => page.id === pageId);
  const cyclic = pageId === context.localPageId;
  let sourceBlock: ProseMirrorNode | null = null;
  if (!cyclic && sourcePage?.body && targetBlockId) {
    try { sourceBlock = findBlock(editor.schema.nodeFromJSON(sourcePage.body), targetBlockId); }
    catch { /* The source is corrupted; the card displays an explicit unavailable state. */ }
  }
  useEffect(() => {
    const host = contentHost.current;
    if (!host) return;
    host.replaceChildren(...(sourceBlock ? [DOMSerializer.fromSchema(editor.schema).serializeNode(sourceBlock)] : []));
  }, [sourceBlock, editor.schema, revision]);

  const loadBlocks = async (sourcePageId: string) => {
    const source = context.getLocalPages().find((page) => page.id === sourcePageId);
    if (!source?.body) return [];
    return listReferenceBlocks(editor.schema.nodeFromJSON(source.body));
  };
  if (editor.isEditable && (editing || !pageId || !targetBlockId)) return <NodeViewWrapper as="div" {...HTMLAttributes} data-fouc-node="block-reference" data-block-reference="picker"><BlockReferencePicker
    excludePageId={context.localPageId} getLocalPages={context.getLocalPages} subscribeLocalPages={context.subscribeLocalPages} loadBlocks={loadBlocks}
    onChoose={(nextPageId, blockId) => { updateAttributes({ pageId: nextPageId, targetBlockId: blockId }); setEditing(false); }}
    onCancel={pageId && targetBlockId ? () => setEditing(false) : undefined}
  /></NodeViewWrapper>;
  const notice = cyclic ? '不能引用当前页面' : !sourcePage ? '来源页面已删除或不可用' : !sourceBlock ? '来源块已删除' : '';
  return <NodeViewWrapper as="div" {...HTMLAttributes} data-fouc-node="block-reference" data-block-reference={notice ? 'unavailable' : 'live'} className={styles.localCard} contentEditable={false}>
    <span className={styles.localAccent} aria-hidden />
    <div className={styles.localBody}>
      <div className={styles.localHeader}><Link aria-hidden size={13} />{sourcePage?.title ?? '块引用'}</div>
      {notice ? <span className={styles.localNotice}>{notice}</span> : <div ref={contentHost} className={styles.localContent} />}
    </div>
    <div className={styles.localActions}>
      {editor.isEditable ? <button type="button" aria-label="更换引用" title="更换引用" onClick={() => setEditing(true)}><PencilSimple aria-hidden size={15} /></button> : null}
      {!notice ? <button type="button" aria-label="打开来源块" title="打开来源块" onClick={() => requestOpenPageBlock({ workspaceId: context.localWorkspaceId, pageId, blockId: targetBlockId })}><ArrowSquareOut aria-hidden size={15} /></button> : null}
    </div>
  </NodeViewWrapper>;
}
