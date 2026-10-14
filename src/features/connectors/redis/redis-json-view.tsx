'use client';

import { useTranslation } from '@/lib/i18n';
import { decodeJsonUnicodeEscapes, formatJsonSource, mapDisplayToRaw } from '@fouc/shared';
import { ArrowCounterClockwise, Copy, FloppyDisk, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { createUiMessages, uiFailure, uiText, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-json-view';
import { RedisJsonEditor } from './redis-json-editor';
import styles from './redis-json.module.css';
const { message: uiMessage, error: uiError } = createUiMessages(unitMessages);

/** Display edits map back to source escapes; numbers are never rebuilt through JS Number. */
export function RedisJsonView({
  content,
  editable,
  onPreview,
  onDraftChange,
}: {
  content: string;
  editable: boolean;
  onPreview: (json: string) => void;
  onDraftChange: (dirty: boolean) => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const baseline = useMemo(() => formatJsonSource(content, 2), [content]);
  const [raw, setRaw] = useState(baseline),
    [decoded, setDecoded] = useState(false),
    [draft, setDraft] = useState(baseline);
  const [wrap, setWrap] = useState(false),
    [search, setSearch] = useState(0),
    [feedback, setFeedback] = useState<UiMessage>(''),
    [error, setError] = useState<UiMessage>('');
  function rawDraft() {
    return decoded ? mapDisplayToRaw(raw, draft) : draft;
  }
  const dirty = draft !== (decoded ? decodeJsonUnicodeEscapes(baseline) : baseline);
  useEffect(() => {
    onDraftChange(dirty && editable);
    return () => onDraftChange(false);
  }, [dirty, editable, onDraftChange]);
  function mode(next: boolean) {
    const source = rawDraft();
    setRaw(source);
    setDraft(next ? decodeJsonUnicodeEscapes(source) : source);
    setDecoded(next);
    setFeedback('');
  }
  function format(indent?: number) {
    try {
      const source = formatJsonSource(rawDraft(), indent);
      setRaw(source);
      setDraft(decoded ? decodeJsonUnicodeEscapes(source) : source);
      setError('');
      setFeedback(uiMessage('已格式化，数值与转义保持原样'));
    } catch (reason) {
      setError(uiFailure(reason));
    }
  }
  function discard() {
    setRaw(baseline);
    setDraft(decoded ? decodeJsonUnicodeEscapes(baseline) : baseline);
    setError('');
    setFeedback(uiMessage('已丢弃草稿修改'));
  }
  function preview() {
    if (!editable || !dirty) return;
    try {
      const source = formatJsonSource(rawDraft());
      if (new TextEncoder().encode(source).length > 1048576)
        throw uiError('RedisJSON 写入文档最多 1 MiB');
      setError('');
      onPreview(source);
    } catch (reason) {
      setError(uiFailure(reason));
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setFeedback(
        uiMessage('已复制{v0}草稿', { v0: uiMessage(decoded ? 'Unicode 显示' : '原始 JSON') }),
      );
    } catch {
      setError(uiMessage('复制失败，请在编辑器中选择内容复制。'));
    }
  }
  return (
    <section className={styles.view} aria-label={tu('RedisJSON 文档')}>
      <div className={styles.toolbar}>
        <div role="tablist" aria-label={tu('RedisJSON Unicode 显示')}>
          <button type="button" role="tab" aria-selected={!decoded} onClick={() => mode(false)}>
            {tu('原始转义')}
          </button>
          <button type="button" role="tab" aria-selected={decoded} onClick={() => mode(true)}>
            {tu('Unicode 显示')}
          </button>
        </div>
        <label>
          <input
            type="checkbox"
            checked={wrap}
            onChange={(event) => setWrap(event.target.checked)}
          />
          {tu('自动换行')}
        </label>
        <button type="button" onClick={() => format(2)}>
          {tu('格式化')}
        </button>
        <button type="button" onClick={() => format()}>
          {tu('压缩')}
        </button>
        <button
          type="button"
          aria-label={tu('搜索 RedisJSON 内容')}
          onClick={() => setSearch((current) => current + 1)}
        >
          <MagnifyingGlass size={14} />
        </button>
        <button type="button" aria-label={tu('复制 RedisJSON 草稿')} onClick={() => void copy()}>
          <Copy size={14} />
        </button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {uiText(error, locale)}
        </p>
      )}
      {feedback && (
        <p role="status" className={styles.feedback}>
          {uiText(feedback, locale)}
        </p>
      )}
      <RedisJsonEditor
        value={draft}
        onChange={(value) => {
          setDraft(value);
          setFeedback('');
          setError('');
        }}
        readOnly={!editable}
        wrap={wrap}
        onSave={preview}
        searchRevision={search}
      />
      <footer>
        <span>
          {tu('显示')} {new TextEncoder().encode(draft).length.toLocaleString(locale)}{' '}
          {tu('字节 ·')} {editable ? tu('⌘ / Ctrl+S 预览变更，确认后保存') : tu('只读文档')}
          {dirty && tu(' · 有未保存草稿')}
        </span>
        {dirty && (
          <>
            <button type="button" onClick={discard}>
              <ArrowCounterClockwise size={13} />
              {tu('丢弃修改')}
            </button>
            <button type="button" disabled={!editable} onClick={preview}>
              <FloppyDisk size={13} />
              {tu('预览变更')}
            </button>
          </>
        )}
      </footer>
    </section>
  );
}
