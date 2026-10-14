import { isolateHistory } from '@codemirror/commands';
import { Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** Apply DBX's selection-first editing rule as one undoable, current-view transaction. */
export async function transformSqlEditor(
  current: () => EditorView | null,
  transform: (sql: string) => string | Promise<string>,
): Promise<'applied' | 'unchanged' | 'stale'> {
  const view = current();
  if (!view || view.state.readOnly) return 'stale';
  const state = view.state,
    selection = state.selection.main;
  const from = selection.empty ? 0 : selection.from,
    to = selection.empty ? state.doc.length : selection.to;
  const original = state.sliceDoc(from, to);
  if (!original.trim()) return 'unchanged';
  const formatted = await transform(original);
  if (
    current() !== view ||
    view.state.doc !== state.doc ||
    !view.state.selection.eq(state.selection) ||
    view.state.readOnly
  )
    return 'stale';
  if (formatted === original) return 'unchanged';
  view.dispatch({
    changes: { from, to, insert: formatted },
    selection: selection.empty
      ? { anchor: Math.min(selection.head, formatted.length) }
      : { anchor: from, head: from + formatted.length },
    annotations: [Transaction.userEvent.of('input.format'), isolateHistory.of('full')],
    scrollIntoView: true,
  });
  view.focus();
  return 'applied';
}
