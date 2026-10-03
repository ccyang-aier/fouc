"use client"

import { useEffect, useRef, type RefObject } from "react"
import {
  autocompletion,
  closeCompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap
} from "@codemirror/autocomplete"
import type { CompletionSource } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { MySQL, PostgreSQL, SQLite, sql } from "@codemirror/lang-sql"
import { sqlKeywordCompletion } from './sql-metadata-completion'
import { EditorState } from "@codemirror/state"
import type { SqlEditorPosition } from '@fouc/shared'
import {
  bracketMatching,
  HighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from "@codemirror/language"
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search"
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers
} from "@codemirror/view"
import { tags } from '@lezer/highlight'

const sqlHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--mw-sql-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--mw-sql-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--mw-sql-number)' },
  { tag: tags.comment, color: 'var(--mw-muted)', fontStyle: 'italic' },
  { tag: [tags.typeName, tags.className], color: 'var(--accent-ink)' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--ink-soft)' }
])

type SqlEditorHandlers = { onChange: (value: string) => void; onRun: () => void; onSave?: () => void; onPositionChange?: (id: string, position: SqlEditorPosition) => void; complete?: CompletionSource }
class SqlEditorCallbacks {
  private positionReporter: ((view: EditorView) => void) | null = null
  constructor(private handlers: SqlEditorHandlers) {}
  get(): SqlEditorHandlers { return this.handlers }
  update(handlers: SqlEditorHandlers): void { this.handlers = handlers }
  setPositionReporter(reporter: ((view: EditorView) => void) | null): void { this.positionReporter = reporter }
  reportPosition(view: EditorView): void { this.positionReporter?.(view) }
}
export type SqlEditorCache = Map<string, { state: EditorState; scrollTop: number; scrollLeft: number; callbacks: SqlEditorCallbacks }>
type Props = {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  onSave?: () => void
  editorRef: RefObject<EditorView | null>
  provider?: "mysql" | "postgres" | "sqlite"
  readOnly?: boolean
  label?: string
  documentId?: string
  positions?: SqlEditorPosition
  cache?: SqlEditorCache
  onPositionChange?: (documentId: string, position: SqlEditorPosition) => void
  complete?: CompletionSource
  completionScope?: string
}

/** DBX's CodeMirror SQL stack adapted to Fouc's React workbench shell. */
export function SqlEditor({
  value,
  onChange,
  onRun,
  onSave,
  editorRef,
  provider = "mysql",
  readOnly = false,
  label = "SQL 编辑器",
  documentId = 'sql', positions, cache, onPositionChange, complete, completionScope
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const initialValue = useRef(value)
  const initialPosition = useRef(positions)
  const handlers = useRef({ onChange, onRun, onSave, onPositionChange, complete })
  const activeCallbacks = useRef<SqlEditorCallbacks | null>(null)

  useEffect(() => {
    handlers.current = { onChange, onRun, onSave, onPositionChange, complete }
    activeCallbacks.current?.update(handlers.current)
    initialValue.current = value
    initialPosition.current = positions
  }, [onChange, onRun, onSave, onPositionChange, complete, value, positions])
  useEffect(() => { if (editorRef.current) closeCompletion(editorRef.current) }, [editorRef, completionScope])

  useEffect(() => {
    const cached = cache?.get(documentId)
    // Cached extensions keep this bridge; bind it to the current React callbacks on every mount.
    const callbacks = cached?.callbacks ?? new SqlEditorCallbacks(handlers.current)
    callbacks.update(handlers.current); activeCallbacks.current = callbacks
    const savedTop = cached?.scrollTop ?? initialPosition.current?.scrollTop ?? 0
    const savedLeft = cached?.scrollLeft ?? initialPosition.current?.scrollLeft ?? 0
    let restoringViewport = true
    callbacks.setPositionReporter(reportPosition)
    const view = new EditorView({
      parent: host.current!,
      ...(cached ? { state: cached.state } : { doc: initialValue.current,
      selection: { anchor: Math.min(initialValue.current.length, initialPosition.current?.anchor ?? 0), head: Math.min(initialValue.current.length, initialPosition.current?.head ?? 0) },
      extensions: [
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        highlightActiveLine(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        syntaxHighlighting(sqlHighlight),
        sql({
          dialect: provider === "postgres" ? PostgreSQL : provider === "sqlite" ? SQLite : MySQL
        }),
        ...(readOnly ? [] : [autocompletion({ override: [sqlKeywordCompletion(provider), (context) => callbacks.get().complete?.(context) ?? null] })]),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": label,
          spellcheck: "false",
          ...(readOnly ? { tabindex: "0" } : {})
        }),
        keymap.of([
          { key: 'Mod-s', run: () => { if (!readOnly) callbacks.get().onSave?.(); return true } },
          {
            key: "Mod-Enter",
            run: () => {
              if (!readOnly) callbacks.get().onRun()
              return true
            }
          },
          indentWithTab,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...searchKeymap
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.get().onChange(update.state.doc.toString())
          if (update.docChanged || update.selectionSet) callbacks.reportPosition(update.view)
        })
      ] })
    })
    function reportPosition(current: EditorView) {
      if (restoringViewport) return
      const { anchor, head } = current.state.selection.main
      callbacks.get().onPositionChange?.(documentId, { anchor, head, scrollTop: current.scrollDOM.scrollTop, scrollLeft: current.scrollDOM.scrollLeft })
    }
    const scroll = () => reportPosition(view)
    const restoreViewport = () => {
      if (!restoringViewport) return
      view.requestMeasure({ read: () => Boolean(host.current?.clientHeight && host.current.clientWidth), write: (visible) => {
        if (!visible || !restoringViewport) return
        view.scrollDOM.scrollTop = savedTop; view.scrollDOM.scrollLeft = savedLeft
        restoringViewport = false; reportPosition(view)
      } })
    }
    // SQL panes initially mount hidden beneath the data tab. Restore after the first visible measure.
    const visibility = new ResizeObserver(restoreViewport)
    visibility.observe(host.current!); restoreViewport()
    view.scrollDOM.addEventListener('scroll', scroll)
    // A returning tab must not revive a popup captured before metadata refresh.
    closeCompletion(view)
    editorRef.current = view
    return () => {
      cache?.set(documentId, { state: view.state, scrollTop: restoringViewport ? savedTop : view.scrollDOM.scrollTop, scrollLeft: restoringViewport ? savedLeft : view.scrollDOM.scrollLeft, callbacks })
      visibility.disconnect(); callbacks.setPositionReporter(null)
      activeCallbacks.current = null
      view.scrollDOM.removeEventListener('scroll', scroll)
      editorRef.current = null
      view.destroy()
    }
  }, [editorRef, provider, readOnly, label, documentId, cache])

  useEffect(() => {
    const view = editorRef.current
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [editorRef, value, documentId])

  return <div ref={host} className="mw-live-code-editor" />
}
