'use client';

import { useSyncExternalStore } from 'react';
import { documentFonts, documentSizes, documentLineHeights, documentParagraphSpacings, documentWidth } from './editor-appearance-options';

export type EditorAppearance = {
  width: number;
  font: typeof documentFonts[number]['id'];
  size: typeof documentSizes[number]['id'];
  lineHeight: typeof documentLineHeights[number];
  paragraphSpacing: typeof documentParagraphSpacings[number]['id'];
  background: string;
};

export const EDITOR_APPEARANCE_DEFAULTS: EditorAppearance = {
  width: 80, font: 'default', size: 'standard', lineHeight: 1.8, paragraphSpacing: 'standard', background: 'white',
};

const preferenceKey = 'fouc.editor-appearance';
const listeners = new Set<() => void>();
let snapshot: EditorAppearance = EDITOR_APPEARANCE_DEFAULTS;
let storedValue: string | null | undefined;
let storageUnavailable = false;

export function normalizeEditorAppearance(value: unknown): EditorAppearance {
  if (!value || typeof value !== 'object') return EDITOR_APPEARANCE_DEFAULTS;
  const prefs = value as Partial<EditorAppearance>;
  return {
    width: typeof prefs.width === 'number' && Number.isFinite(prefs.width) ? Math.round(Math.max(documentWidth.min, Math.min(documentWidth.max, prefs.width))) : 80,
    font: documentFonts.some(item => item.id === prefs.font) ? prefs.font! : 'default',
    size: documentSizes.some(item => item.id === prefs.size) ? prefs.size! : 'standard',
    lineHeight: documentLineHeights.includes(prefs.lineHeight!) ? prefs.lineHeight! : 1.8,
    paragraphSpacing: documentParagraphSpacings.some(item => item.id === prefs.paragraphSpacing) ? prefs.paragraphSpacing! : 'standard',
    background: typeof prefs.background === 'string' && prefs.background.trim() ? prefs.background : 'white',
  };
}

export function getEditorAppearanceSnapshot(): EditorAppearance {
  if (typeof window === 'undefined') return EDITOR_APPEARANCE_DEFAULTS;
  if (storageUnavailable) return snapshot;
  let raw: string | null;
  try { raw = window.localStorage.getItem(preferenceKey); }
  catch { storageUnavailable = true; return snapshot; }
  if (raw !== storedValue) {
    storedValue = raw;
    try { snapshot = normalizeEditorAppearance(raw ? JSON.parse(raw) : null); }
    catch { snapshot = EDITOR_APPEARANCE_DEFAULTS; }
  }
  return snapshot;
}

export function updateEditorAppearance(patch: Partial<EditorAppearance>) {
  const next = normalizeEditorAppearance({ ...getEditorAppearanceSnapshot(), ...patch });
  const raw = JSON.stringify(next);
  try { window.localStorage.setItem(preferenceKey, raw); }
  catch { storageUnavailable = true; }
  storedValue = raw;
  snapshot = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === preferenceKey || event.key === null) listener(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

function getServerSnapshot() { return EDITOR_APPEARANCE_DEFAULTS; }
function reset() { updateEditorAppearance(EDITOR_APPEARANCE_DEFAULTS); }

export function useEditorAppearance() {
  return { appearance: useSyncExternalStore(subscribe, getEditorAppearanceSnapshot, getServerSnapshot), update: updateEditorAppearance, reset };
}

export type EditorBackground = { id: string; label: string; color?: string; image?: string };
export const EDITOR_BACKGROUNDS: readonly EditorBackground[] = [
  { id: 'white', label: '白色', color: '#ffffff' },
  { id: 'warm', label: '暖纸', color: '#faf8f2' },
  { id: 'gray', label: '浅灰', color: '#f4f5f7' },
];

let backgrounds: readonly EditorBackground[] = EDITOR_BACKGROUNDS;
const backgroundListeners = new Set<() => void>();
let database: Promise<IDBDatabase> | undefined;
let loadPromise: Promise<void> | undefined;

function getDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('fouc-editor-backgrounds', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('backgrounds', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('无法打开本机背景存储')); };
  });
}

async function readBackgrounds() {
  const db = await getDatabase();
  const custom = await new Promise<EditorBackground[]>((resolve, reject) => {
    const request = db.transaction('backgrounds', 'readonly').objectStore('backgrounds').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法读取本机背景'));
  });
  backgrounds = [...EDITOR_BACKGROUNDS, ...custom];
  backgroundListeners.forEach(listener => listener());
}

async function writeBackground(id: string, value?: EditorBackground) {
  const db = await getDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('backgrounds', 'readwrite');
    const store = tx.objectStore('backgrounds');
    if (value) store.put(value); else store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('背景保存失败，请检查本机存储空间'));
    tx.onabort = () => reject(new Error('背景保存失败，请检查本机存储空间'));
  });
  await readBackgrounds();
}

async function compressBackground(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片');
  if (file.size > 20 * 1024 * 1024) throw new Error('请选择小于 20 MB 的图片');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2560 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法处理图片，请重试');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL('image/webp', 0.85);
    if (data.length > 2 * 1024 * 1024) data = canvas.toDataURL('image/webp', 0.6);
    if (data.length > 2 * 1024 * 1024) throw new Error('图片细节过多，请换一张较小的图片');
    return data;
  } finally { URL.revokeObjectURL(url); }
}

async function addBackground(file: File): Promise<string> {
  const image = await compressBackground(file);
  const id = `custom-${crypto.randomUUID()}`;
  await writeBackground(id, { id, label: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || '自定义背景', image });
  return id;
}

async function removeBackground(id: string) {
  if (EDITOR_BACKGROUNDS.some(item => item.id === id)) return;
  await writeBackground(id);
  if (getEditorAppearanceSnapshot().background === id) updateEditorAppearance({ background: 'white' });
}

function subscribeBackgrounds(listener: () => void) {
  backgroundListeners.add(listener);
  loadPromise ??= readBackgrounds().catch(() => { loadPromise = undefined; });
  return () => { backgroundListeners.delete(listener); };
}

function getBackgroundSnapshot() { return backgrounds; }
function getBackgroundServerSnapshot() { return EDITOR_BACKGROUNDS; }

export function useEditorBackgrounds() {
  return { backgrounds: useSyncExternalStore(subscribeBackgrounds, getBackgroundSnapshot, getBackgroundServerSnapshot), addBackground, removeBackground };
}
