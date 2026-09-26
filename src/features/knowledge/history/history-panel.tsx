'use client';

/**
 * History panel (V03 §5.3): version list with authors and labels, a read-only
 * preview per checkpoint, one-click "name this version", and restore. Restore
 * replaces the live body in a single editor transaction — undoable for the
 * restoring user, an ordinary update for everyone else.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClockCounterClockwise, FloppyDisk, Spinner, WarningCircle } from '@phosphor-icons/react';
import type { Editor } from '@tiptap/react';
import { createHistoryApi } from './history-api';
import type { HistoryApi, PageCheckpointEntry, PageCheckpointPreview } from './history-api';
import { buildRestoreTransaction, renderCheckpointHtml } from './restore';

type Phase = 'loading' | 'ready' | 'error';
type Feedback = { tone: 'success' | 'error'; text: string } | null;

const formatter = new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const shortAuthor = (userId: string) => userId.slice(0, 8);

export interface HistoryPanelProps {
  workspaceId: string;
  pageId: string;
  /** The live editor; null while the surface is read-only or still mounting. */
  editor: Editor | null;
  /** Edit permission gates naming and restoring. */
  canEdit: boolean;
  onClose: () => void;
  api?: HistoryApi;
}

export function HistoryPanel({ workspaceId, pageId, editor, canEdit, onClose, api = createHistoryApi() }: HistoryPanelProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [entries, setEntries] = useState<PageCheckpointEntry[]>([]);
  const [selected, setSelected] = useState<{ preview: PageCheckpointPreview; html: string | null } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const listRef = useRef(api.list);

  const reload = useCallback(async () => {
    try {
      const { checkpoints } = await listRef.current(workspaceId, pageId);
      setEntries(checkpoints);
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [workspaceId, pageId]);

  useEffect(() => { void reload(); }, [reload]);

  const openPreview = useCallback(async (checkpointId: string) => {
    setPreviewBusy(true);
    setFeedback(null);
    try {
      const preview = await api.preview(workspaceId, pageId, checkpointId);
      setSelected({ preview, html: editor ? renderCheckpointHtml(preview.body, editor.schema) : null });
    } catch {
      setFeedback({ tone: 'error', text: '版本预览加载失败,请重试。' });
    } finally {
      setPreviewBusy(false);
    }
  }, [api, editor, workspaceId, pageId]);

  const nameVersion = useCallback(async () => {
    const trimmed = label.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const result = await api.name(workspaceId, pageId, trimmed);
      setNaming(false);
      setLabel('');
      setFeedback({ tone: 'success', text: result.outcome === 'created' ? '已保存为命名版本。' : '内容与最新版本一致,已为该版本命名。' });
      await reload();
    } catch {
      setFeedback({ tone: 'error', text: '命名失败:内容为空或超过 200 字符。' });
    } finally {
      setBusy(false);
    }
  }, [api, busy, label, pageId, reload, workspaceId]);

  const restore = useCallback(() => {
    if (!selected || !editor || busy) return;
    const transaction = buildRestoreTransaction(editor.state, selected.preview.body);
    if (!transaction) {
      setFeedback({ tone: 'error', text: '该版本内容无法解析,未能恢复。' });
      return;
    }
    editor.view.dispatch(transaction);
    setFeedback({ tone: 'success', text: '已恢复该版本,可通过撤销(Ctrl+Z)回到恢复前状态。' });
    onClose();
  }, [busy, editor, onClose, selected]);

  const sortedAuthors = useMemo(() => (selected?.preview.authors ?? []).map(shortAuthor).join('、'), [selected]);

  return (
    <section aria-label="页面历史版本" className="flex h-full flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <ClockCounterClockwise aria-hidden className="size-4" />
          历史版本
        </h3>
        {canEdit && !naming && (
          <button type="button" onClick={() => setNaming(true)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-overlay hover:text-ink">
            <FloppyDisk aria-hidden className="size-3.5" />
            命名当前版本
          </button>
        )}
      </header>

      {naming && (
        <form
          className="flex gap-2"
          onSubmit={(event) => { event.preventDefault(); void nameVersion(); }}
        >
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={200}
            placeholder="版本名,如「评审基线」"
            aria-label="版本名称"
            className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
          <button type="submit" disabled={busy || !label.trim()} className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-45">
            保存
          </button>
          <button type="button" onClick={() => setNaming(false)} className="rounded-md px-2 py-1.5 text-xs text-muted hover:text-ink">取消</button>
        </form>
      )}

      {feedback && (
        <p role="status" className={`flex items-start gap-1.5 rounded-md px-3 py-2 text-xs ${feedback.tone === 'success' ? 'bg-overlay text-ink' : 'text-danger'}`}>
          {feedback.tone === 'error' && <WarningCircle aria-hidden className="mt-px size-3.5 shrink-0" />}
          {feedback.text}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {phase === 'loading' && (
          <p className="flex items-center gap-2 px-1 text-xs text-muted">
            <Spinner aria-hidden className="size-3.5 animate-spin" />
            正在加载版本…
          </p>
        )}
        {phase === 'error' && (
          <div className="flex flex-col items-start gap-2 text-xs text-muted">
            <p>历史版本暂时不可用。</p>
            <button type="button" onClick={() => { setPhase('loading'); void reload(); }} className="rounded-md border border-line px-2 py-1 text-ink transition-colors hover:bg-overlay">重试</button>
          </div>
        )}
        {phase === 'ready' && entries.length === 0 && <p className="px-1 text-xs text-muted">尚无历史版本;编辑 10 分钟以上或结束会话时会自动生成检查点。</p>}
        <ul className="flex flex-col gap-1">
          {entries.map((entry) => {
            const active = selected?.preview.checkpointId === entry.checkpointId;
            return (
              <li key={entry.checkpointId}>
                <button
                  type="button"
                  onClick={() => void openPreview(entry.checkpointId)}
                  aria-current={active ? 'true' : undefined}
                  className={`w-full rounded-md px-2.5 py-2 text-left transition-colors ${active ? 'bg-overlay' : 'hover:bg-overlay/60'}`}
                >
                  <span className="block truncate text-xs text-ink">{entry.label ?? formatter.format(new Date(entry.createdAt))}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {formatter.format(new Date(entry.createdAt))}
                    {entry.label ? '' : ''}
                    {entry.authors.length > 0 && ` · ${entry.authors.map(shortAuthor).join('、')}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected && (
        <div className="flex min-h-0 flex-[1.4] flex-col gap-2 rounded-lg border border-line bg-panel p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-ink">{selected.preview.label ?? '未命名版本'}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted">
                {formatter.format(new Date(selected.preview.createdAt))}{sortedAuthors && ` · ${sortedAuthors}`}
              </p>
            </div>
            {previewBusy && <Spinner aria-hidden className="size-3.5 animate-spin text-muted" />}
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed text-ink knowledge-preview"
            // Checkpoint HTML is serialized from schema-validated ProseMirror nodes, not user strings.
            dangerouslySetInnerHTML={selected.html ? { __html: selected.html } : undefined}
          >
            {!selected.html && <p className="text-xs text-muted">该版本内容为空或无法预览。</p>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted">恢复会以一次可撤销的编辑覆盖当前正文。</p>
            <button
              type="button"
              onClick={restore}
              disabled={!canEdit || !editor || previewBusy}
              title={!canEdit ? '需要页面编辑权限' : undefined}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-45"
            >
              恢复此版本
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
