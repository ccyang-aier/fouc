'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './mapping-editor.messages';
import { ArrowRight, Key, Plus, Trash } from '@phosphor-icons/react';
import type { DatabaseQueryResult } from '@fouc/shared';
import { columnLabel } from '../result-format';
import { inferCompareKeys, type DataCompareColumnMapping } from './model';
import styles from './compare.module.css';
type Props = {
  left: DatabaseQueryResult;
  right: DatabaseQueryResult;
  mapping: readonly DataCompareColumnMapping[];
  keys: readonly string[];
  primaryKeys?: readonly string[];
  disabled: boolean;
  onChange: (mapping: DataCompareColumnMapping[], keys: string[]) => void;
};
export function CompareMappingEditor({
  left,
  right,
  mapping,
  keys,
  primaryKeys = [],
  disabled,
  onChange,
}: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const availableLeft = left.columns
      .map((_, index) => index)
      .filter((index) => !mapping.some((entry) => entry.left === index)),
    availableRight = right.columns
      .map((_, index) => index)
      .filter((index) => !mapping.some((entry) => entry.right === index));
  return (
    <section className={styles.mapping} aria-label={tConnector('comparedColumnsAndMatchingKeys')}>
      <div className={styles.sectionHead}>
        <strong>{tConnector('columnMappingsAndMatchingKeys')}</strong>
        <span>{tConnector('matchingKeysMustUniquelyIdentifyRowsMultipleColumnsMayBe')}</span>
        <button
          type="button"
          disabled={disabled || !primaryKeys.length}
          onClick={() => onChange([...mapping], inferCompareKeys(left, mapping, primaryKeys))}
        >
          {tConnector('useKnownPrimaryKeys')}
        </button>
      </div>
      <div className={styles.mappingRows}>
        {mapping.map((entry) => (
          <div className={styles.mappingRow} key={entry.id}>
            <button
              type="button"
              disabled={disabled}
              className={keys.includes(entry.id) ? styles.keyActive : styles.keyButton}
              aria-label={tConnector('useAsAMatchingKey', {
                p0: String(columnLabel(left.columns, entry.left)),
              })}
              aria-pressed={keys.includes(entry.id)}
              onClick={() =>
                onChange(
                  [...mapping],
                  keys.includes(entry.id)
                    ? keys.filter((id) => id !== entry.id)
                    : [...keys, entry.id],
                )
              }
            >
              <Key size={14} />
              <span>
                {tConnector('key')}
                {keys.includes(entry.id) && keys.length > 1 ? ` ${keys.indexOf(entry.id) + 1}` : ''}
              </span>
            </button>
            <select
              disabled={disabled}
              aria-label={tConnector('leftColumnFor', { p0: String(entry.id) })}
              value={entry.left}
              onChange={(event) =>
                onChange(
                  mapping.map((item) =>
                    item.id === entry.id ? { ...item, left: Number(event.target.value) } : item,
                  ),
                  [...keys],
                )
              }
            >
              {left.columns.map((_, index) => (
                <option
                  key={index}
                  value={index}
                  disabled={mapping.some((item) => item.id !== entry.id && item.left === index)}
                >
                  {columnLabel(left.columns, index)} ·{' '}
                  {left.columnTypes[index] || tConnector('unknownType')}
                </option>
              ))}
            </select>
            <ArrowRight size={13} className={styles.mappingArrow} />
            <select
              disabled={disabled}
              aria-label={tConnector('rightColumnFor', { p0: String(entry.id) })}
              value={entry.right}
              onChange={(event) =>
                onChange(
                  mapping.map((item) =>
                    item.id === entry.id ? { ...item, right: Number(event.target.value) } : item,
                  ),
                  [...keys],
                )
              }
            >
              {right.columns.map((_, index) => (
                <option
                  key={index}
                  value={index}
                  disabled={mapping.some((item) => item.id !== entry.id && item.right === index)}
                >
                  {columnLabel(right.columns, index)} ·{' '}
                  {right.columnTypes[index] || tConnector('unknownType')}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={disabled}
              aria-label={tConnector('removeMapping', {
                p0: String(columnLabel(left.columns, entry.left)),
              })}
              onClick={() =>
                onChange(
                  mapping.filter((item) => item.id !== entry.id),
                  keys.filter((id) => id !== entry.id),
                )
              }
            >
              <Trash size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className={styles.mappingFoot}>
        <button
          type="button"
          disabled={disabled || !availableLeft.length || !availableRight.length}
          onClick={() =>
            onChange(
              [
                ...mapping,
                {
                  id: `mapping-${crypto.randomUUID()}`,
                  left: availableLeft[0],
                  right: availableRight[0],
                },
              ],
              [...keys],
            )
          }
        >
          <Plus size={13} />
          {tConnector('addColumnMapping')}
        </button>
        <span>
          {mapping.length}
          {tConnector('columnPairs')}
          {keys.length
            ? tConnector('matchingKeys', { p0: String(keys.length) })
            : tConnector('noMatchingKeySelected')}
        </span>
      </div>
    </section>
  );
}
