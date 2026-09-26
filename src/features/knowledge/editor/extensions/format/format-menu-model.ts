/**
 * Pure model of the block format menu: the item list (labels, shortcuts,
 * target formats) plus a keyboard-navigation reducer. The React dropdown
 * stays a thin view over this so the behavior is testable without a DOM.
 */

import type { BlockFormat } from './block-format';

export interface FormatMenuItem {
  id: string;
  label: string;
  /** The Markdown shortcut hint shown next to the label. */
  hint: string;
  /** `null` selects the math insertion command instead of a block format. */
  format: BlockFormat | null;
}

export const FORMAT_MENU_ITEMS: readonly FormatMenuItem[] = [
  { id: 'paragraph', label: '正文', hint: '', format: { kind: 'paragraph' } },
  { id: 'heading-1', label: '标题 1', hint: '#', format: { kind: 'heading', level: 1 } },
  { id: 'heading-2', label: '标题 2', hint: '##', format: { kind: 'heading', level: 2 } },
  { id: 'heading-3', label: '标题 3', hint: '###', format: { kind: 'heading', level: 3 } },
  { id: 'bullet-list', label: '无序列表', hint: '-', format: { kind: 'bulletList' } },
  { id: 'ordered-list', label: '有序列表', hint: '1.', format: { kind: 'orderedList' } },
  { id: 'task-list', label: '待办列表', hint: '[]', format: { kind: 'taskList' } },
  { id: 'blockquote', label: '引用', hint: '>', format: { kind: 'blockquote' } },
  { id: 'code-block', label: '代码块', hint: '```', format: { kind: 'codeBlock' } },
  { id: 'math', label: '公式', hint: '$$', format: null },
];

export interface FormatMenuState {
  open: boolean;
  activeIndex: number;
}

export type FormatMenuEvent =
  | { type: 'open'; activeIndex: number }
  | { type: 'close' }
  /** Arrow steps are ±1; the reducer clamps any overshoot the same way. */
  | { type: 'move'; delta: number }
  | { type: 'home' }
  | { type: 'end' };

/** Arrow/Home/End navigation with clamping (no wrap-around, like GDocs menus). */
export function formatMenuReducer(state: FormatMenuState, event: FormatMenuEvent): FormatMenuState {
  const count = FORMAT_MENU_ITEMS.length;
  switch (event.type) {
    case 'open':
      return { open: true, activeIndex: Math.min(Math.max(event.activeIndex, 0), count - 1) };
    case 'close':
      return { open: false, activeIndex: state.activeIndex };
    case 'move':
      if (!state.open) return state;
      return { ...state, activeIndex: Math.min(Math.max(state.activeIndex + event.delta, 0), count - 1) };
    case 'home':
      if (!state.open) return state;
      return { ...state, activeIndex: 0 };
    case 'end':
      if (!state.open) return state;
      return { ...state, activeIndex: count - 1 };
  }
}

function formatsEqual(a: BlockFormat | null, b: BlockFormat | null): boolean {
  // A plain paragraph reads as `null` from the editor; both match the item.
  const normalize = (format: BlockFormat | null): BlockFormat =>
    format === null || format.kind === 'paragraph' ? { kind: 'paragraph' } : format;
  const left = normalize(a);
  const right = normalize(b);
  if (left.kind !== right.kind) return false;
  return left.kind === 'heading' && right.kind === 'heading' ? left.level === right.level : true;
}

/** Index of the item matching the editor's current block format (-1 = none). */
export function activeFormatItemIndex(current: BlockFormat | null): number {
  return FORMAT_MENU_ITEMS.findIndex((item) => formatsEqual(item.format, current));
}

/** The label shown on the closed trigger button. */
export function formatTriggerLabel(current: BlockFormat | null): string {
  const index = activeFormatItemIndex(current);
  return index >= 0 ? FORMAT_MENU_ITEMS[index].label : '正文';
}
