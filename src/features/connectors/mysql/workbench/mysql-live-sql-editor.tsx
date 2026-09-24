"use client"

import { useEffect, useRef, type RefObject } from "react"
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { MySQL, sql } from "@codemirror/lang-sql"
import { bracketMatching, defaultHighlightStyle, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting } from "@codemirror/language"
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search"
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers } from "@codemirror/view"

type Props = {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  editorRef: RefObject<EditorView | null>
}

/** DBX's CodeMirror SQL stack adapted to Fouc's React workbench shell. */
export function MysqlLiveSqlEditor({ value, onChange, onRun, editorRef }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const initialValue = useRef(value)
  const handlers = useRef({ onChange, onRun })

  useEffect(() => { handlers.current = { onChange, onRun } }, [onChange, onRun])

  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      doc: initialValue.current,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), foldGutter(),
        drawSelection(), highlightActiveLine(), indentOnInput(), bracketMatching(), closeBrackets(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        sql({ dialect: MySQL }), autocompletion(), highlightSelectionMatches(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": "SQL 编辑器", spellcheck: "false" }),
        keymap.of([
          { key: "Mod-Enter", run: () => { handlers.current.onRun(); return true } },
          indentWithTab, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap,
          ...foldKeymap, ...completionKeymap, ...searchKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) handlers.current.onChange(update.state.doc.toString())
        }),
      ],
    })
    editorRef.current = view
    return () => { editorRef.current = null; view.destroy() }
  }, [editorRef])

  useEffect(() => {
    const view = editorRef.current
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [editorRef, value])

  return <div ref={host} className="mw-live-code-editor" />
}
