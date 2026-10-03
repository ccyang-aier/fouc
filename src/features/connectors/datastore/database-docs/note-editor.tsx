import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import type { DatabaseDocsNote } from '@fouc/shared/database-docs';
import styles from './database-docs.module.css';

function safeMarkdownUrl(value: string): string { const url = value.trim(); if (/^[/\\]{2}/.test(url)) return ''; return /^(?:https?:|mailto:|#|\/(?!\/)|\.\.?\/)/i.test(url) ? url : ''; }
export function DocsMarkdown({ children }: { children: string }) { return <div className={styles.markdown}><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeMarkdownUrl}>{children}</Markdown></div>; }
export function DocsNoteEditor({ label, note, editable, saving, onSave }: { label: string; note: DatabaseDocsNote; editable: boolean; saving: boolean; onSave: (value: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(''), [error, setError] = useState(''), [preview, setPreview] = useState(false);
  async function submit() { try { setError(''); await onSave(draft); setEditing(false); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } }
  return <div className={styles.noteEditor}><div className={styles.sectionHeader}><span>{label}</span>{editable && !editing && <button disabled={saving} className={styles.textButton} onClick={() => { setDraft(note.local ?? ''); setEditing(true); setError(''); }}><PencilSimple size={12} />{note.local === null ? '添加本地笔记' : '编辑本地笔记'}</button>}</div>
    {note.database !== null && <div className={styles.nativeNote}><span className={styles.sourceLabel}>数据库原生注释</span><DocsMarkdown>{note.database}</DocsMarkdown></div>}
    {editing ? <div className={styles.editorForm}><div className={styles.editorTabs}><button data-active={!preview} onClick={() => setPreview(false)}>Markdown</button><button data-active={preview} onClick={() => setPreview(true)}>预览</button><small>{new TextEncoder().encode(draft).length.toLocaleString()} / 65,536 bytes</small></div>{preview ? <div className={styles.notePreview}><DocsMarkdown>{draft || '尚未输入笔记。'}</DocsMarkdown></div> : <textarea aria-label={`${label} Markdown`} rows={5} maxLength={65_536} value={draft} disabled={saving} onChange={event => setDraft(event.target.value)} placeholder="Markdown 本地笔记 · 清空后恢复使用数据库原生注释" />}<p className={styles.helper}>只保存到当前设备的工作空间与连接，不修改数据库原生注释。</p>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.editorActions}><button className={styles.secondary} disabled={saving} onClick={() => setEditing(false)}>取消</button><button className={styles.primary} disabled={saving || new TextEncoder().encode(draft).length > 65_536} onClick={() => void submit()}><Check size={13} />{saving ? '保存中…' : '保存笔记'}</button></div></div> : note.local !== null ? <div className={styles.localNote}><span className={styles.sourceLabel}>设备本地 Markdown 笔记</span><DocsMarkdown>{note.local}</DocsMarkdown></div> : note.database === null && <p className={styles.emptyNote}>暂无描述{editable ? '，可添加本地 Markdown 笔记。' : '；当前连接未持久保存。'}</p>}
  </div>;
}
