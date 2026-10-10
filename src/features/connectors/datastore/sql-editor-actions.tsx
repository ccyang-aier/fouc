"use client"

import type { RefObject } from 'react'
import { foldAll, unfoldAll } from '@codemirror/language'
import { isolateHistory } from '@codemirror/commands'
import { Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { ArrowsInLineVertical, ArrowsOutLineVertical, TextAlignJustify } from '@phosphor-icons/react'
import { useAppAlert } from '@/components/app-alert-provider'
import { sqlKeywordCaseChanges } from './sql-editor-commands'

export function SqlEditorActions({ editorRef, disabled, wrapLines, onWrapChange, diagnostics, onDiagnosticsChange }: { editorRef: RefObject<EditorView | null>; disabled: boolean; wrapLines: boolean; onWrapChange: () => void; diagnostics: boolean; onDiagnosticsChange: () => void }) {
  const { notify } = useAppAlert()
  function fold(all: boolean) { const view = editorRef.current; if (view) { (all ? foldAll : unfoldAll)(view); view.focus() } }
  function changeCase() {
    const view = editorRef.current; if (!view) return
    const changes = sqlKeywordCaseChanges(view.state)
    if (!changes) { notify('info', 'SQL 正在解析，请稍后再试'); return }
    view.dispatch({ changes, annotations: [Transaction.userEvent.of('input.keyword-case'), isolateHistory.of('full')] }); view.focus()
  }
  return <>
    <button type="button" className="fouc-action" aria-label="折叠全部 SQL" title="折叠全部 SQL" disabled={disabled} onClick={() => fold(true)}><ArrowsInLineVertical /></button>
    <button type="button" className="fouc-action" aria-label="展开全部 SQL" title="展开全部 SQL" disabled={disabled} onClick={() => fold(false)}><ArrowsOutLineVertical /></button>
    <button type="button" className="fouc-action" aria-label="切换 SQL 关键字大小写" title="切换 SQL 关键字大小写 · 选区优先" disabled={disabled} onClick={changeCase}><strong aria-hidden>A</strong></button>
    <button type="button" className="fouc-action" aria-label="SQL 自动换行" title="SQL 自动换行" aria-pressed={wrapLines} disabled={disabled} onClick={onWrapChange}><TextAlignJustify /></button>
    <button type="button" className="fouc-action" aria-label="SQL 语义诊断" title={diagnostics ? 'SQL 语法与语义提示已开启' : 'SQL 语法与语义提示已关闭'} aria-pressed={diagnostics} disabled={disabled} onClick={onDiagnosticsChange}><strong aria-hidden className="sql-diagnostics-symbol">A</strong></button>
  </>
}
