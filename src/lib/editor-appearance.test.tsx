import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { IDBFactory } from 'fake-indexeddb';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let browser: Window;
let root: Root;
let preferences: typeof import('./editor-appearance');
let backgroundApi: ReturnType<typeof import('./editor-appearance')['useEditorBackgrounds']>;
const key = 'fouc.editor-appearance';

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  globals.window = browser;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'localStorage', 'StorageEvent']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.indexedDB = new IDBFactory();
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  preferences = await import('./editor-appearance');
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  function Consumer({ name }: { name: string }) {
    const { appearance } = preferences.useEditorAppearance();
    return <output data-consumer={name}>{JSON.stringify(appearance)}</output>;
  }
  function Backgrounds() {
    backgroundApi = preferences.useEditorBackgrounds();
    return <output data-backgrounds>{JSON.stringify(backgroundApi.backgrounds)}</output>;
  }
  await act(async () => root.render(<><Consumer name="settings" /><Consumer name="document" /><Backgrounds /></>));
});

afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

describe('editor appearance persisted personal preferences', () => {
  test('keeps stable snapshots and validates malformed input and numeric bounds', () => {
    expect(preferences.getEditorAppearanceSnapshot()).toBe(preferences.getEditorAppearanceSnapshot());
    expect(preferences.normalizeEditorAppearance({ width: 999, font: 'unknown', size: 'unknown', lineHeight: 0, paragraphSpacing: 'unknown', background: '' })).toEqual({ ...preferences.EDITOR_APPEARANCE_DEFAULTS, width: 100 });
    expect(preferences.normalizeEditorAppearance({ width: -2 })).toEqual({ ...preferences.EDITOR_APPEARANCE_DEFAULTS, width: 40 });
    expect(preferences.normalizeEditorAppearance({ width: NaN })).toEqual(preferences.EDITOR_APPEARANCE_DEFAULTS);
  });

  test('a settings update reaches document subscribers and persists the same preference', async () => {
    await act(async () => preferences.updateEditorAppearance({ font: 'wenkai', width: 65, lineHeight: 2, paragraphSpacing: 'relaxed' }));
    const settings = document.querySelector('[data-consumer="settings"]')!.textContent;
    expect(document.querySelector('[data-consumer="document"]')!.textContent).toBe(settings);
    expect(JSON.parse(settings!)).toMatchObject({ font: 'wenkai', width: 65, lineHeight: 2, paragraphSpacing: 'relaxed' });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(JSON.parse(settings!));
  });

  test('another window preference update refreshes subscribers, and reset restores defaults', async () => {
    await act(async () => {
      localStorage.setItem(key, JSON.stringify({ ...preferences.EDITOR_APPEARANCE_DEFAULTS, font: 'zhenkai', width: 73 }));
      browser.dispatchEvent(new browser.StorageEvent('storage', { key }));
    });
    expect(document.querySelector('[data-consumer="settings"]')!.textContent).toContain('"zhenkai"');
    await act(async () => preferences.updateEditorAppearance(preferences.EDITOR_APPEARANCE_DEFAULTS));
    expect(preferences.getEditorAppearanceSnapshot()).toEqual(preferences.EDITOR_APPEARANCE_DEFAULTS);
  });

  test('background upload rejects unsupported formats before storing anything', async () => {
    await expect(backgroundApi.addBackground(new File(['invalid'], 'background.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG、JPEG 或 WebP');
    expect(backgroundApi.backgrounds).toHaveLength(3);
  });

  test('custom backgrounds persist in IndexedDB, avoid localStorage image data, and removal restores white', async () => {
    const globals = globalThis as Record<string, unknown>;
    const originalImage = globals.Image;
    const originalContext = browser.HTMLCanvasElement.prototype.getContext;
    const originalDataUrl = browser.HTMLCanvasElement.prototype.toDataURL;
    const imageData = 'data:image/webp;base64,UklGRg==';
    globals.Image = class { width = 160; height = 90; src = ''; async decode() {} };
    browser.HTMLCanvasElement.prototype.getContext = (() => ({ drawImage() {} })) as unknown as typeof originalContext;
    browser.HTMLCanvasElement.prototype.toDataURL = () => imageData;
    try {
      let id = '';
      await act(async () => { id = await backgroundApi.addBackground(new File(['image'], 'Team wall.png', { type: 'image/png' })); });
      expect(backgroundApi.backgrounds.find(item => item.id === id)).toEqual({ id, label: 'Team wall', image: imageData });
      expect(localStorage.getItem(key)).not.toContain('data:image');
      const request = indexedDB.open('fouc-editor-backgrounds', 1);
      const database = await new Promise<IDBDatabase>(resolve => { request.onsuccess = () => resolve(request.result); });
      const record = database.transaction('backgrounds').objectStore('backgrounds').get(id);
      const persisted = await new Promise(resolve => { record.onsuccess = () => resolve(record.result); });
      expect(persisted).toEqual({ id, label: 'Team wall', image: imageData });
      await act(async () => preferences.updateEditorAppearance({ background: id }));
      await act(async () => backgroundApi.removeBackground(id));
      expect(backgroundApi.backgrounds).toHaveLength(3);
      expect(preferences.getEditorAppearanceSnapshot().background).toBe('white');
      database.close();
    } finally {
      globals.Image = originalImage;
      browser.HTMLCanvasElement.prototype.getContext = originalContext;
      browser.HTMLCanvasElement.prototype.toDataURL = originalDataUrl;
    }
  });

  test('storage denied still applies settings in memory', async () => {
    const setItem = browser.Storage.prototype.setItem;
    browser.Storage.prototype.setItem = () => { throw new Error('denied'); };
    try {
      await act(async () => preferences.updateEditorAppearance({ font: 'mono', size: 'large' }));
      expect(preferences.getEditorAppearanceSnapshot()).toMatchObject({ font: 'mono', size: 'large' });
      expect(document.querySelector('[data-consumer="document"]')!.textContent).toContain('"mono"');
    } finally { browser.Storage.prototype.setItem = setItem; }
  });
});
