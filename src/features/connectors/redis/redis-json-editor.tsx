"use client"
import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { bracketMatching, defaultHighlightStyle, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, openSearchPanel, searchKeymap } from '@codemirror/search'
import { json } from '@codemirror/lang-json'
import styles from './redis-json.module.css'

/** DBX's folding/history/find/save JSON editor adapted to a React lifecycle. */
export function RedisJsonEditor({ value, onChange, readOnly, wrap, onSave, searchRevision = 0, label = 'RedisJSON 编辑器' }: {
  value: string; onChange: (value: string) => void; readOnly: boolean; wrap: boolean; onSave: () => void; searchRevision?: number; label?: string
}) {
  const host = useRef<HTMLDivElement>(null), editor = useRef<EditorView | null>(null)
  const handlers = useRef({ onChange, onSave, readOnly }), initial = useRef(value)
  const compartments = useRef({ mode: new Compartment(), wrapping: new Compartment() })
  useEffect(() => { handlers.current = { onChange, onSave, readOnly } }, [onChange, onSave, readOnly])
  useEffect(() => {
    const view = new EditorView({ parent: host.current!, doc: initial.current, extensions: [
      json(), lineNumbers(), foldGutter(), history(), drawSelection(), bracketMatching(), indentOnInput(), closeBrackets(),
      highlightActiveLine(), highlightActiveLineGutter(), highlightSelectionMatches(), syntaxHighlighting(defaultHighlightStyle),
      compartments.current.mode.of([]), compartments.current.wrapping.of([]),
      EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }),
      keymap.of([{ key: 'Mod-s', run: () => { if (!handlers.current.readOnly) handlers.current.onSave(); return true } },
        indentWithTab, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap, ...searchKeymap]),
      EditorView.updateListener.of((update) => { if (update.docChanged) handlers.current.onChange(update.state.doc.toString()) }),
    ] })
    editor.current = view
    return () => { editor.current = null; view.destroy() }
  }, [label])
  useEffect(() => {
    editor.current?.dispatch({ effects: [compartments.current.mode.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
      compartments.current.wrapping.reconfigure(wrap ? EditorView.lineWrapping : [])] })
  }, [readOnly, wrap])
  useEffect(() => { const view = editor.current; if (view && value !== view.state.doc.toString()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }) }, [value])
  useEffect(() => { if (searchRevision && editor.current) openSearchPanel(editor.current) }, [searchRevision])
  return <div ref={host} className={styles.editor} />
}
