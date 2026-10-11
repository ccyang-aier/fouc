import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { DatabaseQueryResult } from '@fouc/shared'
import { defaultGridLayout, displayedGridColumns, gridColumnKeys, type GridLayout } from './model'
import type { GridFieldFilter as Fields } from './field-filter'
import type { GridViewOptions as Options } from './view-options'

let browser: Window, root: Root, GridFieldFilter: typeof Fields, GridViewOptions: typeof Options, latest: GridLayout
const result: DatabaseQueryResult = { columns: ['id', 'name', 'city'], columnTypes: ['int', 'text', 'text'], columnSortables: [true, true, true], rows: [[1, 'Alpha', null]], affectedRows: 0, executionTimeMs: 0, hasMore: false, truncated: false, sessionId: null, messages: [] }, keys = gridColumnKeys(result.columns)
beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' }); const globals = globalThis as Record<string, unknown>
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'ResizeObserver', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) globals[name] = (browser as unknown as Record<string, unknown>)[name]
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true
  GridFieldFilter = (await import('./field-filter')).GridFieldFilter; GridViewOptions = (await import('./view-options')).GridViewOptions
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort() })
function Harness() { const [layout, change] = useState(defaultGridLayout); useEffect(() => { latest = layout }, [layout]); return <><GridFieldFilter result={result} keys={keys} layout={layout} onChange={change} /><GridViewOptions result={result} layout={layout} onChange={change} /><output>{displayedGridColumns(result, keys, layout).map(index => result.columns[index]).join(',')}</output></> }
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label') === label || button.textContent === label)!
async function click(label: string) { await act(async () => button(label).click()) }
test('field checks update visibility immediately, preserve one column, and keyboard reordering includes hidden columns', async () => {
  await act(async () => root.render(<Harness key="fields" />)); await click('字段筛选')
  await click('name'); await click('city')
  expect(document.querySelector('output')?.textContent).toBe('id')
  expect(button('id').disabled).toBe(true); await click('id')
  expect(document.querySelector('output')?.textContent).toBe('id')
  await click('显示全部')
  const grip = button('移动字段 id')
  for (const key of [' ', 'ArrowDown', ' ']) await act(async () => grip.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
  expect(document.querySelector('output')?.textContent).toBe('name,id,city')
  await click('重置顺序'); expect(latest.order).toEqual([])
  await click('自动适配列宽'); expect(Object.keys(latest.widths)).toHaveLength(3)
})
test('view options are immediate preferences, including NULL visibility, and offer no render mode', async () => {
  await act(async () => root.render(<Harness key="options" />)); await click('视图选项')
  expect(document.body.textContent).not.toContain('渲染模式')
  await click('填满可用宽度'); await click('高亮'); await click('原始行号'); await click('多行'); await click('左对齐'); await click('复选框'); await click('数据类型着色'); await click('隐藏 NULL 列')
  expect(latest.widthMode).toBe('fill'); expect(latest.searchMode).toBe('highlight'); expect(latest.rowNumberMode).toBe('source'); expect(latest.transposeMode).toBe('multiple'); expect(latest.numericAlign).toBe('left'); expect(latest.booleanMode).toBe('checkbox'); expect(latest.typeColors).toBe(true)
  expect(document.querySelector('output')?.textContent).toBe('id,name')
  expect(result.rows[0]).toEqual([1, 'Alpha', null])
})
