export const documentFonts = [
  { id: 'default', label: '默认字体', family: 'var(--font-sans)' },
  { id: 'wenkai', label: '霞鹜文楷', family: '"Fouc Document WenKai", serif' },
  { id: 'wenkai-screen', label: '文楷屏幕版', family: '"Fouc Document WenKai Screen", serif' },
  { id: 'zhenkai', label: '霞鹜臻楷', family: '"Fouc Document ZhenKai", serif' },
  { id: 'serif', label: '思源宋体', family: '"Noto Serif SC", serif' },
  { id: 'mono', label: '系统等宽', family: 'var(--font-code), monospace' },
] as const;

export const documentSizes = [
  { id: 'extra-small', label: '更小', pixels: 14 },
  { id: 'small', label: '小', pixels: 15 },
  { id: 'standard', label: '标准', pixels: 16 },
  { id: 'large', label: '大', pixels: 18 },
  { id: 'extra-large', label: '更大', pixels: 20 },
] as const;

export const documentWidth = { min: 40, max: 100, default: 80 };
export const documentCodeFonts = [
  { id: 'default', label: '默认等宽', family: 'var(--font-code)' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', family: '"JetBrains Mono", var(--font-code)' },
  { id: 'fira-code', label: 'Fira Code', family: '"Fira Code", var(--font-code)' },
  { id: 'source-code-pro', label: 'Source Code Pro', family: '"Source Code Pro", var(--font-code)' },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', family: '"IBM Plex Mono", var(--font-code)' },
] as const;
export const documentLineHeights = [1.5, 1.8, 2] as const;
export const documentParagraphSpacings = [
  { id: 'compact', label: '紧凑', pixels: 8 },
  { id: 'standard', label: '标准', pixels: 18 },
  { id: 'relaxed', label: '宽松', pixels: 28 },
] as const;
