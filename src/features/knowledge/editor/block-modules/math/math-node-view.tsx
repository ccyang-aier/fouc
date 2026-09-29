'use client';

import { useRef, useState } from 'react';
import { Check, Copy, Function as FunctionIcon } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import styles from './math.module.css';

const SYMBOLS = [
  { label: '分式', latex: '\\frac{}{}', cursor: 6 },
  { label: '平方根', latex: '\\sqrt{}', cursor: 6 },
  { label: '求和', latex: '\\sum_{i=1}^{n}', cursor: 7 },
  { label: '积分', latex: '\\int_{}^{}', cursor: 6 },
  { label: '希腊字母', latex: '\\alpha', cursor: 6 },
] as const;

function renderFormula(latex: string): { html: string; error: string | null } {
  if (!latex.trim()) return { html: '', error: null };
  try {
    return { html: katex.renderToString(latex, { displayMode: true, throwOnError: true, trust: false, output: 'html' }), error: null };
  } catch (error) {
    return { html: '', error: error instanceof Error ? error.message : '公式语法无效' };
  }
}

export function MathNodeView({ node, editor, updateAttributes, selected, HTMLAttributes }: NodeViewProps) {
  const latex = String(node.attrs.latex ?? '');
  const rendered = renderFormula(latex);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const insertSymbol = (snippet: typeof SYMBOLS[number]) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? latex.length;
    const end = input?.selectionEnd ?? start;
    const next = latex.slice(0, start) + snippet.latex + latex.slice(end);
    updateAttributes({ latex: next });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(start + snippet.cursor, start + snippet.cursor);
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(latex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  };

  return (
    <NodeViewWrapper as="div" {...HTMLAttributes} data-fouc-node="math" data-block-id={node.attrs.blockId} className={styles.root} data-selected={String(selected)}>
      <div className={styles.head} contentEditable={false}>
        <span className={styles.label}><FunctionIcon aria-hidden size={16} /> 数学公式</span>
        {latex ? <button type="button" className={styles.copy} onClick={copy}>{copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}{copied ? '已复制' : '复制 LaTeX'}</button> : null}
      </div>
      <div className={styles.preview} contentEditable={false} aria-live="polite">
        {rendered.html ? <div dangerouslySetInnerHTML={{ __html: rendered.html }} /> : <span className={styles.previewPlaceholder}>{latex ? '修正语法后会显示预览' : '输入 LaTeX 公式，预览会实时显示在这里'}</span>}
      </div>
      {editor.isEditable ? (
        <div className={styles.editArea} contentEditable={false}>
          <div className={styles.symbols} role="toolbar" aria-label="插入公式符号">
            {SYMBOLS.map((symbol) => <button key={symbol.label} type="button" title={symbol.label} aria-label={`插入${symbol.label}`} onMouseDown={(event) => event.preventDefault()} onClick={() => insertSymbol(symbol)}>{symbol.latex}</button>)}
          </div>
          <textarea ref={inputRef} aria-label="LaTeX 公式源码" spellCheck={false} rows={2} value={latex} onChange={(event) => updateAttributes({ latex: event.target.value })} placeholder="例如：E = mc^2" className={styles.input} />
          {rendered.error ? <p className={styles.error} role="status">{rendered.error}</p> : <p className={styles.hint}>使用 LaTeX 语法 · 输入时即时预览</p>}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}
