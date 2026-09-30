import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let root: Root;
let browser: Window;
let star = false;
let comments = 0;
let history = 0;
let deletes = 0;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const { DocumentAppearanceProvider } = await import('./document-appearance');
  const { DocumentMoreMenu } = await import('./document-more-menu');
  function MenuHarness() {
    const [starred, setStarred] = useState(false);
    return <DocumentAppearanceProvider scope="test-menu"><DocumentMoreMenu editor={null} title="测试文档" starred={starred} onToggleStar={() => { star = !star; setStarred(star); }} actions={{ target: { workspaceId: 'w', knowledgeBaseId: 'k', pageId: 'p', source: 'local' }, onComments: () => { comments++; }, onHistory: () => { history++; }, onDelete: async () => { deletes++; throw new Error('save-failed'); } }} /></DocumentAppearanceProvider>;
  }
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<MenuHarness />);
  });
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

async function key(element: Element, value: string) {
  await act(async () => { element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); });
}
async function open() {
  const trigger = document.querySelector('[aria-label="更多文档操作"]')!;
  await key(trigger, 'Enter');
}
function item(label: string) {
  return Array.from(document.querySelectorAll('[role="menuitem"]')).find((element) => element.textContent === label)!;
}

describe('document menu rendered interaction', () => {
  test('opens five separated groups, has all requested entries and removes the editing toolbar', async () => {
    await open();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.querySelectorAll('[role="separator"]').length).toBe(4);
    for (const text of ['复制', '个性化设置', '演示', '收藏', '订阅', '权限', '模板化', '评论', '历史记录', '导出', '打印', '删除', '导入', '移动', '固定', '在拆分视图打开', '在文档中搜索']) expect(document.querySelector('[role="menu"]')!.textContent).toContain(text);
    expect(document.querySelector('[role="toolbar"]')).toBeNull();
    expect(document.querySelector('[role="menu"]')!.textContent).not.toContain('历史版本');
    expect(item('收藏').hasAttribute('data-disabled')).toBe(false);
    const permission = Array.from(document.querySelectorAll('[role="menuitem"]')).find((element) => element.textContent?.startsWith('权限'))!;
    expect(permission.hasAttribute('data-disabled')).toBe(true);
  });
  test('copy submenu includes four formats and disables unloaded content', async () => {
    await key(item('复制'), 'ArrowRight');
    expect(item('复制为链接').hasAttribute('data-disabled')).toBe(false);
    for (const label of ['复制为文本', '复制为 Markdown', '复制为 HTML']) expect(item(label).hasAttribute('data-disabled')).toBe(true);
    await key(document.querySelector('[aria-label="更多文档操作"]')!, 'Escape');
  });
  test('appearance updates persist as view preferences, and favorite toggles its label', async () => {
    await open();
    await key(item('个性化设置'), 'ArrowRight');
    const wide = Array.from(document.querySelectorAll('[role="menuitemcheckbox"]')).find((element) => element.textContent === '宽版')!;
    await act(async () => wide.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(wide.getAttribute('aria-checked')).toBe('true');
    expect(JSON.parse(localStorage.getItem('fouc.document.appearance:test-menu')!).width).toBe('wide');
    await key(document.querySelector('[aria-label="更多文档操作"]')!, 'Escape');
    await open();
    await act(async () => item('收藏').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(star).toBe(true);
    await open();
    expect(item('取消收藏')).not.toBeUndefined();
  });
  test('comments and history invoke the resource callbacks', async () => {
    await act(async () => item('评论').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(comments).toBe(1);
    await open();
    await act(async () => item('历史记录').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(history).toBe(1);
  });
  test('delete requires confirmation and reports persistence failure without discarding the document', async () => {
    await open();
    await act(async () => item('删除').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(deletes).toBe(0);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('可以从回收站恢复');
    const confirm = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === '移至回收站')!;
    await act(async () => { confirm.click(); });
    expect(deletes).toBe(1);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('文档已保留');
    const cancel = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === '取消')!;
    await act(async () => { cancel.click(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
