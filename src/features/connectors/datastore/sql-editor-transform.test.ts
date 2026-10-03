import { test, expect } from 'bun:test'
import { EditorState, StateEffect, Transaction, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { history, undo } from '@codemirror/commands'
import { transformSqlEditor } from './sql-editor-transform'

function editor(sql: string, from = 0, to = from) {
  const view = { state: EditorState.create({ doc: sql, selection: { anchor: from, head: to }, extensions: [history()] }), dispatch(spec: TransactionSpec | Transaction) { this.state = spec instanceof Transaction ? spec.state : this.state.update(spec).state }, focus() {} }
  view.dispatch = view.dispatch.bind(view)
  return view as unknown as EditorView
}
test('selection format leaves surrounding SQL and restores the exact document with one undo', async () => {
  const view = editor('before; select 1; after;', 8, 16)
  expect(await transformSqlEditor(() => view, () => 'SELECT 1')).toBe('applied')
  expect(view.state.doc.toString()).toBe('before; SELECT 1; after;')
  undo(view)
  expect(view.state.doc.toString()).toBe('before; select 1; after;')
})
test('background tooltip effects permit formatting but a changed selection does not', async () => {
  const view = editor('select 1')
  expect(await transformSqlEditor(() => view, async () => {
    view.dispatch({ effects: StateEffect.define<boolean>().of(false) })
    return 'SELECT 1'
  })).toBe('applied')
  expect(await transformSqlEditor(() => view, async () => {
    view.dispatch({ selection: { anchor: 1 } })
    return 'SELECT 2'
  })).toBe('stale')
})

test('an asynchronous formatter cannot overwrite typing or a different document', async () => {
  const view = editor('select 1')
  let resolve!: (text: string) => void
  const result = transformSqlEditor(() => view, () => new Promise<string>((done) => { resolve = done }))
  view.dispatch({ changes: { from: 8, insert: ' + 1' } })
  resolve('SELECT 1')
  expect(await result).toBe('stale')
  expect(view.state.doc.toString()).toBe('select 1 + 1')
  const next = editor('select 2')
  let current = view
  const switched = transformSqlEditor(() => current, () => new Promise<string>((done) => { resolve = done }))
  current = next; resolve('SELECT 1 + 1')
  expect(await switched).toBe('stale')
  expect(next.state.doc.toString()).toBe('select 2')
})
