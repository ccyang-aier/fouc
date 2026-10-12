import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act, StrictMode, useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SqlDraftSnapshot, SqlDraftState } from '@fouc/shared'
import { SqlDraftController } from './sql-draft-controller'
import { closeSqlTabs, newSqlTab } from './sql-tabs'
import { useSqlOpenRequest, type SqlOpenRequest } from './use-sql-open-request'
import type { WorkbenchTabs as Tabs } from './workbench-tabs'

let browser: Window, root: Root, WorkbenchTabs: typeof Tabs
const empty = (): SqlDraftSnapshot => ({ tabs: [], activeTabId: null })

beforeAll(async () => {
  browser = new Window()
  const globals = globalThis as Record<string, unknown>
  for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'ResizeObserver']) globals[name] = (browser as unknown as Record<string, unknown>)[name]
  globals.window = browser; globals.IS_REACT_ACT_ENVIRONMENT = true
  WorkbenchTabs = (await import('./workbench-tabs')).WorkbenchTabs
})
beforeEach(() => { const host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren() })
afterAll(async () => { await browser.happyDOM.abort() })

function Query({ controller, request, consumed }: { controller: SqlDraftController; request: SqlOpenRequest | null; consumed: (id: string) => void }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useSqlOpenRequest({ controller, state, request, provider: 'sqlite', database: 'test.sqlite', schema: 'main', onConsumed: consumed })
  useEffect(() => { void controller.load() }, [controller])
  return null
}
function Workbench({ controller }: { controller: SqlDraftController }) {
  const [opened, setOpened] = useState(false), [request, setRequest] = useState<SqlOpenRequest | null>(null), [mount, setMount] = useState(0)
  return <>
    <WorkbenchTabs table="" schema="main" mode={opened ? 'sql' : 'data'} openedViews={opened ? ['sql'] : []} disabled={false} onChange={() => setOpened(true)} onCloseTable={() => {}} onCloseView={() => setOpened(false)} onSqlTabsTarget={() => {}}
      onNewQuery={() => { setRequest({ id: crypto.randomUUID(), sql: '', schema: 'main' }); setOpened(true) }} />
    <button onClick={() => setMount(current => current + 1)}>重新挂载查询视图</button>
    <button onClick={() => { controller.update(snapshot => closeSqlTabs(snapshot, snapshot.tabs.map(tab => tab.id))); setOpened(false) }}>关闭全部查询</button>
    {opened && <Query key={mount} controller={controller} request={request} consumed={id => setRequest(current => current?.id === id ? null : current)} />}
  </>
}
async function click(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(element => (element.getAttribute('aria-label') ?? element.textContent) === label)!
  expect(button).toBeDefined()
  await act(async () => button.click())
}

test('one New click during first asynchronous restore opens exactly one query under StrictMode', async () => {
  let release!: (state: SqlDraftState) => void
  const controller = new SqlDraftController({ read: () => new Promise(resolve => { release = resolve }), write: async snapshot => ({ ...snapshot, version: 'saved', updatedAt: 1 }) }, empty)
  await act(async () => root.render(<StrictMode><Workbench controller={controller} /></StrictMode>))
  await click('新建 SQL 查询')
  expect(controller.getSnapshot().tabs).toHaveLength(0)
  await act(async () => release({ ...empty(), version: null, updatedAt: null }))
  expect(controller.getSnapshot().tabs).toHaveLength(1)
  expect(controller.getSnapshot().tabs[0].title).toBe('查询 1')
  expect(controller.getSnapshot().tabs[0].sql).toBe('')
  await act(async () => controller.flush())
  await click('重新挂载查询视图')
  expect(controller.getSnapshot().tabs).toHaveLength(1)
  await click('新建 SQL 查询')
  expect(controller.getSnapshot().tabs).toHaveLength(2)
  await act(async () => controller.flush())
  await click('关闭全部查询')
  await act(async () => controller.flush())
  await click('新建 SQL 查询')
  expect(controller.getSnapshot().tabs).toHaveLength(1)
  await act(async () => controller.flush())
})

test('an already applied command is not duplicated on remount and each distinct command opens one query', async () => {
  const controller = new SqlDraftController(null, empty)
  const request = { id: crypto.randomUUID(), sql: 'SELECT 42;', schema: 'main' }
  const consumed: string[] = []
  const render = async (key: string, value: SqlOpenRequest) => act(async () => root.render(<StrictMode><Query key={key} controller={controller} request={value} consumed={id => { consumed.push(id) }} /></StrictMode>))
  await render('first', request)
  expect(controller.getSnapshot().tabs).toHaveLength(1)
  expect(controller.getSnapshot().tabs[0].id).toBe(request.id)
  expect(consumed).toEqual([request.id])
  await render('remount', request)
  expect(controller.getSnapshot().tabs).toHaveLength(1)
  await render('remount', { ...request, id: crypto.randomUUID() })
  expect(controller.getSnapshot().tabs).toHaveLength(2)
})

test('opening SQL without a New command creates one initial query and keeps an explicitly empty saved workspace empty', async () => {
  const controller = new SqlDraftController(null, empty)
  await act(async () => root.render(<StrictMode><Query controller={controller} request={null} consumed={() => {}} /></StrictMode>))
  expect(controller.getSnapshot().tabs).toHaveLength(1)
  expect(controller.getSnapshot().tabs[0].sql).toBe('SELECT 1 AS result;')
  const closed = new SqlDraftController({ read: async () => ({ ...empty(), version: 'closed', updatedAt: 1 }), write: async () => { throw new Error('Must not create a phantom tab') } }, empty)
  await act(async () => root.render(<StrictMode><Query key="closed" controller={closed} request={null} consumed={() => {}} /></StrictMode>))
  expect(closed.getSnapshot().tabs).toHaveLength(0)
  expect(closed.getSnapshot().pending).toBe(false)
})

test('New appends one query to existing restored documents', async () => {
  const saved = newSqlTab('test.sqlite', 'main', '已有查询')
  const controller = new SqlDraftController({ read: async () => ({ tabs: [saved], activeTabId: saved.id, version: 'existing', updatedAt: 1 }), write: async snapshot => ({ ...snapshot, version: 'saved', updatedAt: 2 }) }, empty)
  await act(async () => root.render(<StrictMode><Workbench controller={controller} /></StrictMode>))
  await click('新建 SQL 查询')
  expect(controller.getSnapshot().tabs).toHaveLength(2)
  expect(controller.getSnapshot().tabs[0]).toEqual(saved)
  expect(controller.getSnapshot().tabs[1].title).toBe('查询 2')
  await act(async () => controller.flush())
})
