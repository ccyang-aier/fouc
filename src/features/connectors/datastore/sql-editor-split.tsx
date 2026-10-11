"use client"

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './sql-editor-split.module.css'

/** DBX's editor/result divider adapted to pointer and keyboard input in the Web workbench. */
export function SqlEditorSplit({ editor, result, resultMinHeight = 0, resultsVisible = true, onShowResults }: { editor: ReactNode; result: ReactNode; resultMinHeight?: number; resultsVisible?: boolean; onShowResults: () => void }) {
  const resultId = useId()
  const root = useRef<HTMLDivElement>(null)
  const editorPane = useRef<HTMLDivElement>(null), restoreButton = useRef<HTMLButtonElement>(null)
  const previousVisibility = useRef(resultsVisible)
  const [size, setSize] = useState(48)
  const [resizing, setResizing] = useState(false)
  useLayoutEffect(() => {
    if (previousVisibility.current === resultsVisible) return
    previousVisibility.current = resultsVisible
    if (resultsVisible) editorPane.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus({ preventScroll: true })
    else restoreButton.current?.focus({ preventScroll: true })
  }, [resultsVisible])
  function resize(clientY: number) {
    const bounds = root.current?.getBoundingClientRect()
    if (bounds?.height) setSize(Math.max(20, Math.min(80, ((clientY - bounds.top) / bounds.height) * 100)))
  }
  return <div ref={root} className={`mw-editor-split ${styles.root}`} data-resizing={resizing || undefined} style={{ '--editor-share': `${size}%`, ...(!resultsVisible ? { gridTemplateRows: 'minmax(0, 1fr)' } : resultMinHeight ? { gridTemplateRows: `minmax(80px, min(var(--editor-share), max(80px, calc(100% - ${resultMinHeight + 7}px)))) 7px minmax(0, 1fr)` } : {}) } as CSSProperties}>
    <div ref={editorPane} className="mw-editor-pane">{editor}</div>
    <div hidden={!resultsVisible} role="separator" aria-label="调整 SQL 编辑器与结果区高度" aria-orientation="horizontal" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(size)} tabIndex={0} className="mw-editor-divider"
      onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setResizing(true); resize(event.clientY) }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(event.clientY) }}
      onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setResizing(false) }}
      onLostPointerCapture={() => setResizing(false)}
      onKeyDown={(event) => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
        event.preventDefault(); setSize((value) => event.key === 'Home' ? 20 : event.key === 'End' ? 80 : Math.max(20, Math.min(80, value + (event.key === 'ArrowUp' ? -5 : 5))))
      }}><span /></div>
    <div id={resultId} hidden={!resultsVisible} className="mw-result">{result}</div>
    {!resultsVisible && <button ref={restoreButton} type="button" className={`fouc-action ${styles.restore}`} aria-controls={resultId} aria-expanded={false} onClick={onShowResults}>显示结果</button>}
  </div>
}
