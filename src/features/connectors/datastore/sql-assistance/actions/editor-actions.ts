import { isolateHistory } from '@codemirror/commands'
import { Transaction, type EditorState, type ChangeSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { RelationalProvider } from '@fouc/shared'
import { sqlSemanticDialectFor } from '../../sql-semantic/dialect'
import { convertSqlSelectionCase } from './selection-case'
import { caretPositionInsideInsertedSqlSingleQuotes, resolveSqlSingleQuoteKeyAction } from './quote-caret'

export type SqlActionSnapshot = { view: EditorView; state: EditorState }
export type SqlActionEdit = { changes: ChangeSpec; anchor?: number; head?: number }
export type SqlTextAction = 'upper' | 'lower' | 'quote-string' | 'quote-identifier' | 'unquote' | 'json-string'

export function captureSqlAction(view: EditorView | null): SqlActionSnapshot | null { return view && !view.state.readOnly ? { view, state: view.state } : null }
export function applySqlAction(current: () => EditorView | null, snapshot: SqlActionSnapshot, edit: SqlActionEdit): boolean {
  const state = snapshot.view.state
  if (current() !== snapshot.view || state.doc !== snapshot.state.doc || !state.selection.eq(snapshot.state.selection) || state.readOnly) return false
  snapshot.view.dispatch({ changes: edit.changes, ...(edit.anchor === undefined ? {} : { selection: { anchor: edit.anchor, head: edit.head ?? edit.anchor } }),
    annotations: [Transaction.userEvent.of('input.sql-action'), isolateHistory.of('full')], scrollIntoView: true })
  snapshot.view.focus(); return true
}

export function sqlStringLiteral(text: string, provider: RelationalProvider): string {
  const escaped = provider === 'mysql' ? text.replaceAll('\\', '\\\\') : text
  return `'${escaped.replaceAll("'", "''")}'`
}

/** DBX's explicit selection case changes protect literals outside the selected literal. */
export function sqlTextActionEdit(snapshot: SqlActionSnapshot, action: SqlTextAction, provider: RelationalProvider): SqlActionEdit | null {
  const state = snapshot.state, range = state.selection.main, sql = state.doc.toString()
  if (range.empty && action !== 'quote-string') return null
  let replacement = ''
  if (action === 'upper' || action === 'lower') replacement = convertSqlSelectionCase(sql, range, action, provider)
  else if (action === 'quote-string') {
    if (range.empty) {
      const keyAction = resolveSqlSingleQuoteKeyAction({ previousChar: sql[range.head - 1], nextChar: sql[range.head] })
      if (keyAction === 'skipClosingQuote') return { changes: [], anchor: range.head + 1 }
      replacement = keyAction === 'insertEscapedQuote' ? "'" : "''"
    } else replacement = sqlStringLiteral(state.sliceDoc(range.from, range.to), provider)
  } else if (action === 'quote-identifier') replacement = sqlSemanticDialectFor({ provider }).quoteIdentifier(state.sliceDoc(range.from, range.to))
  else if (action === 'json-string') replacement = JSON.stringify(state.sliceDoc(range.from, range.to))
  else {
    const text = state.sliceDoc(range.from, range.to), first = text[0], last = text.at(-1)
    if (text.length < 2 || !((first === last && ['"', "'", '`'].includes(first)) || first === '[' && last === ']')) return null
    replacement = text.slice(1, -1).replaceAll(last! + last!, last!)
    if (provider === 'mysql' && first === "'") replacement = replacement.replaceAll('\\\\', '\\')
  }
  if (replacement === state.sliceDoc(range.from, range.to)) return null
  if (range.empty && action === 'quote-string') {
    const next = sql.slice(0, range.from) + replacement + sql.slice(range.to)
    const caret = caretPositionInsideInsertedSqlSingleQuotes({ previousValue: sql, nextValue: next, selectionStart: range.from + replacement.length })
    return { changes: { from: range.from, to: range.to, insert: replacement }, anchor: caret ?? range.from + replacement.length }
  }
  return { changes: { from: range.from, to: range.to, insert: replacement }, anchor: range.from, head: range.from + replacement.length }
}

/** Add generated queries after the active document, preserving the source table text. */
export function sqlAppendQueryEdit(snapshot: SqlActionSnapshot, query: string): SqlActionEdit {
  const doc = snapshot.state.doc.toString(), separator = !doc.trim() ? '' : /;\s*$/.test(doc) ? '\n\n' : '\n;\n\n'
  return { changes: { from: doc.length, insert: separator + query }, anchor: doc.length + separator.length, head: doc.length + separator.length + query.length }
}
