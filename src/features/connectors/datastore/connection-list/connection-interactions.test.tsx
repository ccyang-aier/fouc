import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ConnectionTarget as Target } from './connection-target'
import type { ConnectionDialogActions as Actions } from '../connection-options/connection-dialog-actions'
import type { TooltipProvider as Provider } from '@/components/ui/tooltip'

let browser: Window, root: Root
let ConnectionTarget: typeof Target, ConnectionDialogActions: typeof Actions, TooltipProvider: typeof Provider
beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000' })
  const globals = globalThis as Record<string, unknown>
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) globals[key] = (browser as unknown as Record<string, unknown>)[key]
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true
  ConnectionTarget = (await import('./connection-target')).ConnectionTarget
  ConnectionDialogActions = (await import('../connection-options/connection-dialog-actions')).ConnectionDialogActions
  TooltipProvider = (await import('@/components/ui/tooltip')).TooltipProvider
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host)
}, 30000)
afterAll(async () => { if (root) await act(async () => root.unmount()); await browser.happyDOM.abort() })

test('copy uses the complete path and a rejected clipboard write never reports success', async () => {
  const targetTitle = 'C:\\data\\local.sqlite'
  let copied = ''
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text } } })
  await act(async () => root.render(<TooltipProvider><ConnectionTarget label="文件" row={{ id: 'local', name: 'Local', target: 'local.sqlite', targetTitle, projectIds: [], tags: [], favorite: false, status: 'passed' }} /></TooltipProvider>))
  await act(async () => document.querySelector<HTMLButtonElement>('button')!.click())
  expect(copied).toBe(targetTitle)
  expect(document.querySelector('[role="status"]')?.textContent).toBe('已复制')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied') } } })
  await act(async () => document.querySelector<HTMLButtonElement>('button')!.click())
  expect(document.querySelector('[role="status"]')?.textContent).toBe('复制失败，请重试')
  expect(document.querySelector('[data-copied="true"]')).toBeNull()
})

test('testing disables actions without relabeling save, and outcomes stay beside the test action', async () => {
  const props = { valid: true, feedback: '', testError: '', submitLabel: '保存连接', onTest: () => {}, onClose: () => {} }
  await act(async () => root.render(<TooltipProvider><ConnectionDialogActions {...props} pending="test" /></TooltipProvider>))
  expect(document.querySelector('[aria-busy="true"]')?.textContent).toBe('测试中')
  expect(document.querySelector('button[type="submit"]')?.textContent).toBe('保存连接')
  expect([...document.querySelectorAll<HTMLButtonElement>('button')].every(button => button.disabled)).toBe(true)
  await act(async () => root.render(<TooltipProvider><ConnectionDialogActions {...props} pending={null} feedback="SQLite 3.53.2" /></TooltipProvider>))
  expect(document.querySelector('footer [role="status"]')?.textContent).toBe('测试通过')
  await act(async () => root.render(<TooltipProvider><ConnectionDialogActions {...props} pending={null} testError="文件不存在" /></TooltipProvider>))
  expect(document.querySelector('footer [role="alert"]')?.textContent).toBe('连接失败')
  expect(document.querySelector('[role="status"]')).toBeNull()
})

test('connection feedback tooltips stay inside the native modal top layer', async () => {
  await act(async () => root.render(<TooltipProvider><dialog open><ConnectionDialogActions pending={null} valid feedback="SQLite 3.53.2" testError="" submitLabel="保存连接" onTest={() => {}} onClose={() => {}} /></dialog></TooltipProvider>))
  await act(async () => document.querySelector<HTMLElement>('[role="status"]')!.focus())
  const tooltip = document.querySelector('[data-slot="tooltip-content"]')
  expect(tooltip?.closest('dialog[open]')).not.toBeNull()
  expect(tooltip?.textContent).toContain('SQLite 3.53.2')
})
