'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './entry-detail.messages';
import { useState } from 'react';
import type { RelationalProvider } from '@fouc/shared';
import { columnLabel } from '../result-format';
import { compareCellAt, type DataCompareEntry, type DataCompareResult } from './model';
import { compareCellKind, compareCellText } from './values';
import styles from './compare.module.css';
export function CompareEntryDetail({
  entry,
  comparison,
  provider,
  leftLabel,
  rightLabel,
}: {
  entry: DataCompareEntry;
  comparison: DataCompareResult;
  provider?: RelationalProvider;
  leftLabel: string;
  rightLabel: string;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [leftIndex, setLeftIndex] = useState(entry.leftRows[0]),
    [rightIndex, setRightIndex] = useState(entry.rightRows[0]);
  return (
    <section className={styles.detail} aria-label={tConnector('dataDifferenceDetails')}>
      <div className={styles.sectionHead}>
        <strong>{tConnector('differenceDetails')}</strong>
        <span>
          {entry.changes.length
            ? tConnector('fieldsChanged', { p0: String(entry.changes.length) })
            : entry.kind === 'conflict'
              ? tConnector('adjustTheMatchingKeyOrSourceData')
              : entry.kind === 'unchanged'
                ? tConnector('mappedColumnsMatch')
                : tConnector('presentOnOnlyOneSideWithinThisRange')}
        </span>
      </div>
      {entry.reasons.length > 0 && (
        <div className={styles.conflictReasons} role="alert">
          {entry.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      )}
      <div className={styles.detailSides}>
        {(['left', 'right'] as const).map((side) => (
          <label key={side}>
            <span title={side === 'left' ? leftLabel : rightLabel}>
              {side === 'left' ? leftLabel : rightLabel}
            </span>
            <select
              aria-label={tConnector('sideDetailRow', {
                p0: String(side === 'left' ? tConnector('left') : tConnector('right')),
              })}
              disabled={!entry[side === 'left' ? 'leftRows' : 'rightRows'].length}
              value={side === 'left' ? (leftIndex ?? '') : (rightIndex ?? '')}
              onChange={(event) =>
                side === 'left'
                  ? setLeftIndex(Number(event.target.value))
                  : setRightIndex(Number(event.target.value))
              }
            >
              {!entry[side === 'left' ? 'leftRows' : 'rightRows'].length && (
                <option value="">{tConnector('notPresentInTheCurrentRange')}</option>
              )}
              {entry[side === 'left' ? 'leftRows' : 'rightRows'].map((index) => (
                <option key={index} value={index}>
                  {tConnector('loadedResultRow')}
                  {index + 1}
                  {tConnector('row')}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className={styles.detailMatrix}>
        <table>
          <thead>
            <tr>
              <th>{tConnector('mappedColumn')}</th>
              <th>{tConnector('leftRawValue')}</th>
              <th>{tConnector('rightRawValue')}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.mapping.map((mapping) => {
              const leftValue =
                  leftIndex === undefined
                    ? undefined
                    : compareCellAt(comparison.left.rows[leftIndex], mapping.left),
                rightValue =
                  rightIndex === undefined
                    ? undefined
                    : compareCellAt(comparison.right.rows[rightIndex], mapping.right),
                changed = entry.changes.some((change) => change.mappingId === mapping.id);
              return (
                <tr key={mapping.id} data-changed={changed || undefined}>
                  <th>
                    <strong>{columnLabel(comparison.left.columns, mapping.left)}</strong>
                    <small>
                      → {columnLabel(comparison.right.columns, mapping.right)}
                      {comparison.keyColumns.includes(mapping.id) ? tConnector('matchingKey') : ''}
                    </small>
                  </th>
                  {(['left', 'right'] as const).map((side) => {
                    const value = side === 'left' ? leftValue : rightValue,
                      type = comparison[side].columnTypes[mapping[side]];
                    return (
                      <td key={side}>
                        <small>{compareCellKind(value, type, provider, locale)}</small>
                        <pre>{compareCellText(value, true, locale)}</pre>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
