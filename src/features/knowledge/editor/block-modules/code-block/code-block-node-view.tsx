'use client';

import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { Check, Copy, DotsThree, TextAlignLeft } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { CODE_LANGUAGES, detectedCodeLanguage } from './highlight';
import styles from './code-block.module.css';

const CodeContent = NodeViewContent as unknown as FC<{ as: 'pre'; className?: string }>;

export function CodeBlockNodeView({ node, editor, updateAttributes, HTMLAttributes }: NodeViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const language = String(node.attrs.language || 'auto');
  const detected = language === 'auto' ? detectedCodeLanguage(node.textContent) : null;
  const lines = Math.max(1, node.textContent.split('\n').length);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [settingsOpen]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <NodeViewWrapper
      as="div"
      {...HTMLAttributes}
      data-fouc-node="code-block"
      data-block-id={node.attrs.blockId}
      data-code-theme={node.attrs.theme}
      data-code-font={node.attrs.font}
      data-code-wrap={String(node.attrs.wrap)}
      className={styles.root}
    >
      <div className={styles.header} contentEditable={false}>
        <div className={styles.languageRow}>
          <span aria-hidden className={styles.languageDot} />
          <select
            aria-label="代码语言"
            value={language}
            disabled={!editor.isEditable}
            onChange={(event) => updateAttributes({ language: event.target.value === 'auto' ? null : event.target.value })}
            className={styles.languageSelect}
          >
            {CODE_LANGUAGES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          {detected ? <span className={styles.detected}>{CODE_LANGUAGES.find((option) => option.value === detected)?.label ?? detected}</span> : null}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.iconButton} onClick={copy} aria-label={copied ? '已复制代码' : '复制代码'} title={copied ? '已复制' : '复制代码'}>
            {copied ? <Check aria-hidden size={15} /> : <Copy aria-hidden size={15} />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
          {editor.isEditable ? (
            <div ref={menuRef} className={styles.menuAnchor}>
              <button type="button" className={styles.iconButton} aria-label="代码块显示设置" aria-expanded={settingsOpen} aria-haspopup="menu" onClick={() => setSettingsOpen((value) => !value)}>
                <DotsThree aria-hidden size={19} weight="bold" />
              </button>
              {settingsOpen ? (
                <div role="menu" aria-label="代码块显示设置" className={styles.menu} onKeyDown={(event) => { if (event.key === 'Escape') setSettingsOpen(false); }}>
                  <div className={styles.menuTitle}>外观</div>
                  <div className={styles.themeRow}>
                    {(['light', 'dark', 'paper'] as const).map((theme) => (
                      <button key={theme} type="button" aria-label={`${{ light: '浅色', dark: '深色', paper: '纸张' }[theme]}主题`} aria-pressed={node.attrs.theme === theme} className={styles.themeOption} data-theme={theme} onClick={() => updateAttributes({ theme })}>
                        <span aria-hidden>Aa</span>
                        <small>{{ light: '浅色', dark: '深色', paper: '纸张' }[theme]}</small>
                      </button>
                    ))}
                  </div>
                  <div className={styles.menuDivider} />
                  <label className={styles.menuRow}>字体<select aria-label="代码字体" value={node.attrs.font} onChange={(event) => updateAttributes({ font: event.target.value })}><option value="mono">等宽</option><option value="serif">衬线</option></select></label>
                  <button type="button" role="menuitemcheckbox" aria-checked={Boolean(node.attrs.lineNumbers)} className={styles.menuRow} onClick={() => updateAttributes({ lineNumbers: !node.attrs.lineNumbers })}><span>显示行号</span><span className={styles.toggle} data-on={String(node.attrs.lineNumbers)} /></button>
                  <button type="button" role="menuitemcheckbox" aria-checked={Boolean(node.attrs.wrap)} className={styles.menuRow} onClick={() => updateAttributes({ wrap: !node.attrs.wrap })}><span className={styles.wrapLabel}><TextAlignLeft aria-hidden size={15} />自动换行</span><span className={styles.toggle} data-on={String(node.attrs.wrap)} /></button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.body}>
        {node.attrs.lineNumbers ? <div className={styles.gutter} contentEditable={false} aria-hidden>{Array.from({ length: lines }, (_, index) => <span key={index}>{index + 1}</span>)}</div> : null}
        <CodeContent as="pre" className={styles.code} />
      </div>
    </NodeViewWrapper>
  );
}
