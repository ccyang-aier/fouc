import { closeCompletion } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { EditorView, hoverTooltip, keymap, showTooltip } from '@codemirror/view'
import type { RelationalProvider } from '@fouc/shared'
import { getSqlFunctionSignatureHelp, MAX_SQL_ASSISTANCE_DOCUMENT_CHARS, SQL_SIGNATURE_SCAN_LIMIT_CHARS, sqlFunctionAtPosition, type SqlFunctionSignatureHelp } from './signature'
import { createSqlFunctionDocumentationDom, createSqlSignatureTooltipDom } from './tooltip-dom'

function suppressed(state: EditorState, cursor: number): boolean {
  for (let node = syntaxTree(state).resolveInner(cursor, -1); node; node = node.parent!) {
    if (/String|Comment|QuotedIdentifier/.test(node.name)) return true
    if (!node.parent) break
  }
  return false
}
type SignatureState = { help: SqlFunctionSignatureHelp; cursor: number; focused: boolean } | null

/** Bounded DBX signature windows plus hover help, owned by the current editor instance. */
export function sqlFunctionSignatureExtensions(provider: RelationalProvider): Extension[] {
  const dismiss = StateEffect.define<null>()
  const focus = StateEffect.define<boolean>()
  const resolve = (state: EditorState, focused: boolean): SignatureState => {
    if (!focused || state.selection.main.from !== state.selection.main.to || state.doc.length > MAX_SQL_ASSISTANCE_DOCUMENT_CHARS) return null
    const cursor = state.selection.main.head
    if (suppressed(state, cursor)) return null
    const from = Math.max(0, cursor - SQL_SIGNATURE_SCAN_LIMIT_CHARS)
    const help = getSqlFunctionSignatureHelp(state.doc.sliceString(from, cursor), cursor - from, provider, { truncatedPrefix: from > 0 })
    return help ? { help, cursor, focused } : null
  }
  let focused = false
  const field = StateField.define<SignatureState>({
    create: () => null,
    update: (value, transaction) => {
      for (const effect of transaction.effects) {
        if (effect.is(dismiss)) return null
        if (effect.is(focus)) { focused = effect.value; return resolve(transaction.state, focused) }
      }
      return transaction.docChanged || transaction.selection ? resolve(transaction.state, focused) : value
    },
    provide: (stateField) => showTooltip.from(stateField, (value) => value ? {
      pos: value.cursor, above: false, clip: false, create: () => ({ dom: createSqlSignatureTooltipDom(value.help, provider) }),
    } : null),
  })
  return [field,
    EditorView.focusChangeEffect.of((_state, hasFocus) => focus.of(hasFocus)),
    keymap.of([{ key: 'Escape', run: (view) => {
      if (!view.state.field(field)) return false
      closeCompletion(view); view.dispatch({ effects: dismiss.of(null) }); return true
    } }]),
    hoverTooltip((view, position, side) => {
      if (view.state.doc.length > MAX_SQL_ASSISTANCE_DOCUMENT_CHARS || suppressed(view.state, position)) return null
      const call = sqlFunctionAtPosition(view.state.doc.toString(), position, provider)
      if (!call || position === call.from && side < 0 || position === call.to && side > 0) return null
      return { pos: call.from, end: call.to, above: true, create: () => ({ dom: createSqlFunctionDocumentationDom(call.definition, provider) }) }
    }, { hideOnChange: true, hoverTime: 350 }),
  ]
}
