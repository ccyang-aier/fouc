"use client"

import { useEffect, useRef, type RefObject } from "react"
import {
  autocompletion,
  closeCompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  nextSnippetField,
  prevSnippetField
} from "@codemirror/autocomplete"
import type { CompletionSource } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { MySQL, PostgreSQL, SQLite, sql } from "@codemirror/lang-sql"
import { sqlKeywordCompletion } from './sql-metadata-completion'
import { sqlSnippetCompletion } from './sql-snippet-completion'
import { MAX_SQL_ASSISTANCE_DOCUMENT_CHARS, sqlFunctionCompletion, sqlFunctionReplacesKeyword, sqlFunctionSignatureExtensions } from './sql-assistance/functions'
import { sqlDiagnosticsExtensions } from './sql-assistance/diagnostics'
import './sql-assistance/functions/theme.css'
import { Compartment, EditorState, StateEffect } from "@codemirror/state"
import { getOverlayRoot } from '@/lib/overlay-root'
import type { SqlEditorPosition, SqlExecutionMode, SqlFormatterCase, SqlSnippet } from '@fouc/shared'
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
  lineNumbers,
  tooltips
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

const tooltipParent = new Compartment()

type SqlEditorHandlers = { onChange: (value: string) => void; onRun: (mode?: SqlExecutionMode) => void; onSave?: () => void; onFormat?: () => void; onPositionChange?: (id: string, position: SqlEditorPosition) => void; complete?: CompletionSource; snippets?: SqlSnippet[]; keywordCase?: SqlFormatterCase; functionCase?: SqlFormatterCase }
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
  onRun: (mode?: SqlExecutionMode) => void
  onSave?: () => void
  onFormat?: () => void
  snippets?: SqlSnippet[]
  keywordCase?: SqlFormatterCase
  functionCase?: SqlFormatterCase
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
  onFormat, snippets, keywordCase, functionCase,
  editorRef,
  provider = "mysql",
  readOnly = false,
  label = "SQL 编辑器",
  documentId = 'sql', positions, cache, onPositionChange, complete, completionScope
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const initialValue = useRef(value)
  const initialPosition = useRef(positions)
  const handlers = useRef({ onChange, onRun, onSave, onFormat, onPositionChange, complete, snippets, keywordCase, functionCase })
  const activeCallbacks = useRef<SqlEditorCallbacks | null>(null)

  useEffect(() => {
    handlers.current = { onChange, onRun, onSave, onFormat, onPositionChange, complete, snippets, keywordCase, functionCase }
    activeCallbacks.current?.update(handlers.current)
    initialValue.current = value
    initialPosition.current = positions
  }, [onChange, onRun, onSave, onFormat, onPositionChange, complete, snippets, keywordCase, functionCase, value, positions])
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
    const bounded = (source: CompletionSource): CompletionSource => (context) => context.state.doc.length > MAX_SQL_ASSISTANCE_DOCUMENT_CHARS ? null : source(context)
    const keywordSource = sqlKeywordCompletion(provider)
    const keywords: CompletionSource = (context) => {
      const result = keywordSource(context)
      if (!result || !('options' in result)) return result
      // Built-in functions use argument fields and documentation below; real
      // keyword entries and metadata columns retain their distinct sources.
      return { ...result, options: result.options.filter((option) => !sqlFunctionReplacesKeyword(option.label, provider)) }
    }
    const extensions = [
        tooltipParent.of(tooltips({ parent: getOverlayRoot() ?? document.body })),
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
        ...(readOnly ? [] : [autocompletion({ tooltipClass: () => 'fouc-sql-completion', override: [bounded(keywords), bounded(sqlSnippetCompletion(provider, () => callbacks.get())), sqlFunctionCompletion(provider, () => callbacks.get()), bounded((context) => callbacks.get().complete?.(context) ?? null)] }),
          ...sqlFunctionSignatureExtensions(provider), ...sqlDiagnosticsExtensions(provider)]),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": label,
          spellcheck: "false",
          ...(readOnly ? { tabindex: "0" } : {})
        }),
        keymap.of([
          { key: 'Mod-Shift-Enter', run: () => { if (!readOnly) callbacks.get().onRun('all'); return true } },
          { key: 'Mod-s', run: () => { if (!readOnly) callbacks.get().onSave?.(); return true } },
          { key: 'Mod-Shift-f', run: () => { if (readOnly || !callbacks.get().onFormat) return false; callbacks.get().onFormat?.(); return true } },
          {
            key: "Mod-Enter",
            run: () => {
              if (!readOnly) callbacks.get().onRun()
              return true
            }
          },
          { key: 'Tab', run: nextSnippetField },
          { key: 'Shift-Tab', run: prevSnippetField },
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
    ]
    // Reconfigure extensions while retaining document/history fields: hot reload and
    // returning tabs must receive current snippet sources, keymaps and overlay host.
    const state = cached ? cached.state.update({ effects: StateEffect.reconfigure.of(extensions) }).state : EditorState.create({
      doc: initialValue.current,
      selection: { anchor: Math.min(initialValue.current.length, initialPosition.current?.anchor ?? 0), head: Math.min(initialValue.current.length, initialPosition.current?.head ?? 0) },
      extensions
    })
    const view = new EditorView({ parent: host.current!, state })
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
