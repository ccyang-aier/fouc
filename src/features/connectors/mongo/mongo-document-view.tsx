'use client';
import { useTranslation } from '@/lib/i18n';
import { mongoDocumentFields, mongoValueText, mongoValueType } from '@fouc/shared/mongo';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { useMemo, useState } from 'react';
import { createUiMessages, uiText, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/mongo-document-view';
import styles from './mongo.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

function JsonBranch({ name, value, depth = 0 }: { name: string; value: unknown; depth?: number }) {
  const { t: tu } = useTranslation(unitMessages);

  const type = mongoValueType(value),
    nested = type === 'object' || type === 'array';
  if (!nested)
    return (
      <div className={styles.leaf}>
        <span className={styles.fieldName}>{name}</span>
        <span className={styles.type}>{type}</span>
        <code className={styles.value}>{mongoValueText(value)}</code>
      </div>
    );
  const entries = Object.entries(value as object);
  if (depth >= 12)
    return (
      <div className={styles.leaf}>
        <span>{name}</span>
        <code className={styles.value}>{JSON.stringify(value)}</code>
      </div>
    );
  return (
    <details open={depth < 2} className={styles.branch}>
      <summary>
        <span>{name}</span>
        <span className={styles.type}>
          {type} · {entries.length}
        </span>
      </summary>
      <div>
        {entries.slice(0, 200).map(([key, child]) => (
          <JsonBranch key={key} name={key} value={child} depth={depth + 1} />
        ))}
        {entries.length > 200 && (
          <div className={styles.muted}>{tu('当前层仅展示前 200 项；JSON 视图保留完整文档。')}</div>
        )}
      </div>
    </details>
  );
}

export function MongoDocuments({
  documents,
  selected,
  onSelect,
}: {
  documents: string[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const { t: tu } = useTranslation(unitMessages);

  const fields = useMemo(() => mongoDocumentFields(documents), [documents]);
  const rows = useMemo(
    () => documents.map((text) => JSON.parse(text) as Record<string, unknown>),
    [documents],
  );
  const columns = fields.slice(0, 200);
  return (
    <div className={styles.tableWrap}>
      {fields.length > 200 && (
        <p className={styles.notice}>{tu('表格展示前 200 个字段。选择文档可查看全部字段。')}</p>
      )}
      <table className={styles.documentTable}>
        <thead>
          <tr>
            <th className={styles.rowNumber}>#</th>
            {columns.map((field) => (
              <th key={field}>{field}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} data-selected={selected === index} onClick={() => onSelect(index)}>
              <td className={styles.rowNumber}>
                <button
                  aria-label={tu('查看第 {v0} 个文档', { v0: String(index + 1) })}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(index);
                  }}
                >
                  {index + 1}
                </button>
              </td>
              {columns.map((field) => (
                <td
                  key={field}
                  title={`${mongoValueType(row[field])}: ${mongoValueText(row[field])}`}
                >
                  <span className={styles.cell} data-type={mongoValueType(row[field])}>
                    {mongoValueText(row[field])}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function MongoDocumentDetails({ text, onClose }: { text: string; onClose: () => void }) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [mode, setMode] = useState<'tree' | 'json'>('tree'),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState<UiMessage>('');
  const value = useMemo(() => JSON.parse(text) as unknown, [text]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError(uiMessage('复制失败，请从 JSON 视图选择文本。'));
    }
  }
  return (
    <aside className={styles.details}>
      <div className={styles.detailsHeader}>
        <strong>{tu('文档详情')}</strong>
        <button className={styles.iconButton} aria-label={tu('关闭文档详情')} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className={styles.detailToolbar}>
        <div className={styles.segment}>
          <button data-active={mode === 'tree'} onClick={() => setMode('tree')}>
            {tu('结构')}
          </button>
          <button data-active={mode === 'json'} onClick={() => setMode('json')}>
            JSON
          </button>
        </div>
        <button className={styles.smallButton} onClick={() => void copy()}>
          <Copy size={13} />
          {copied ? tu('已复制') : tu('复制 EJSON')}
        </button>
      </div>
      <p className={styles.precision}>{tu('Canonical Extended JSON · BSON 类型与精度完整保留')}</p>
      {copyError && (
        <p role="alert" className={styles.error}>
          {uiText(copyError, locale)}
        </p>
      )}
      <div className={styles.detailContent}>
        {mode === 'json' ? (
          <pre className={styles.json}>{JSON.stringify(value, null, 2)}</pre>
        ) : (
          <JsonBranch name="Document" value={value} />
        )}
      </div>
    </aside>
  );
}
