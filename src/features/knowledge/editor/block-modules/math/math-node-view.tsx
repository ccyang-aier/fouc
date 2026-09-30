'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Function as FunctionIcon } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import styles from './math.module.css';

const SYMBOLS = [
  { label: '分式', glyph: '½', latex: '\\frac{}{}', cursor: 6 },
  { label: '平方根', glyph: '√', latex: '\\sqrt{}', cursor: 6 },
  { label: '求和', glyph: 'Σ', latex: '\\sum_{i=1}^{n}', cursor: 7 },
  { label: '积分', glyph: '∫', latex: '\\int_{}^{}', cursor: 6 },
  { label: '希腊字母', glyph: 'α', latex: '\\alpha', cursor: 6 },
  { label: '下标', glyph: 'xₙ', latex: '_{}', cursor: 2 },
  { label: '上标', glyph: 'x²', latex: '^{}', cursor: 2 },
  { label: '矩阵', glyph: '▦', latex: '\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}', cursor: 15 },
] as const;

function renderFormula(latex: string) {
  if (!latex.trim()) return { html: '', error: null };
  try { return { html: katex.renderToString(latex, { displayMode: true, throwOnError: true, trust: false, output: 'html' }), error: null }; }
  catch (error) { return { html: '', error: error instanceof Error ? error.message : '公式语法无效' }; }
}
export function MathNodeView({ node, editor, updateAttributes, HTMLAttributes }: NodeViewProps) {
  const latex = String(node.attrs.latex ?? '');
  const rendered = useMemo(() => renderFormula(latex), [latex]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  };
  const insertSymbol = (snippet: typeof SYMBOLS[number]) => {
    const start = inputRef.current?.selectionStart ?? latex.length;
    const end = inputRef.current?.selectionEnd ?? start;
    updateAttributes({ latex: latex.slice(0, start) + snippet.latex + latex.slice(end) });
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(start + snippet.cursor, start + snippet.cursor); });
  };
  return <NodeViewWrapper as="div" {...HTMLAttributes} data-fouc-node="math" data-math="" data-latex={latex} data-block-id={node.attrs.blockId} className={styles.root}>
    {editor.isEditable && <div className={styles.editArea} contentEditable={false} data-document-export-omit>
      <textarea ref={inputRef} aria-label="LaTeX 公式源码" spellCheck={false} rows={Math.min(5, latex.split('\n').length)} value={latex}
        onChange={event => updateAttributes({ latex: event.target.value })} placeholder="输入 LaTeX 公式…" className={styles.input} />
      <div className={styles.actions}>
        {latex && <button type="button" aria-label={copied ? '已复制 LaTeX' : '复制 LaTeX'} onClick={copy}>{copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}</button>}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger aria-label="公式快捷输入"><FunctionIcon size={17} aria-hidden /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.symbols}>{SYMBOLS.map(symbol => <DropdownMenuItem key={symbol.label}
            aria-label={'插入' + symbol.label} onSelect={() => insertSymbol(symbol)}>
            <span className={styles.glyph} aria-hidden>{symbol.glyph}</span>{symbol.label}
          </DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>}
    {rendered.html && <div className={styles.preview} contentEditable={false} aria-live="polite" dangerouslySetInnerHTML={{ __html: rendered.html }} />}
    {rendered.error && editor.isEditable && <p className={styles.error} role="status" title={rendered.error} data-document-export-omit>公式语法有误，请检查 LaTeX。</p>}
  </NodeViewWrapper>;
}
