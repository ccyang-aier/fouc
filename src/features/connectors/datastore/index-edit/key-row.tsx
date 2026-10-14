'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './key-row.messages';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import {
  indexEditPrefixColumn,
  type IndexEditKey,
  type IndexEditOptions,
} from '@fouc/shared/index-edit';
import styles from './index-edit.module.css';
interface Props {
  position: number;
  value: IndexEditKey;
  options: IndexEditOptions;
  selected: IndexEditKey[];
  include: string[];
  disabled: boolean;
  onChange: (patch: Partial<IndexEditKey>) => void;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
}
export function IndexKeyRow({
  position,
  value,
  options,
  selected,
  include,
  disabled,
  onChange,
  onDelete,
  onMove,
}: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const column = options.structure.columns.find((item) => item.name === value.column);
  const prefixAllowed = options.capabilities.prefix && column && indexEditPrefixColumn(column);
  return (
    <tr>
      <td>{position + 1}</td>
      <td>
        <select
          aria-label={tConnector('indexColumn', { p0: String(position + 1) })}
          value={value.column}
          disabled={disabled}
          onChange={(event) => onChange({ column: event.target.value, prefix: null })}
        >
          {options.structure.columns.map((item) => (
            <option
              key={item.name}
              value={item.name}
              disabled={
                include.includes(item.name) ||
                selected.some((other, index) => index !== position && other.column === item.name)
              }
            >
              {item.name}
            </option>
          ))}
        </select>
        <small>{column?.dataType}</small>
      </td>
      <td>
        <select
          aria-label={tConnector('indexSortOrder', { p0: String(position + 1) })}
          disabled={disabled}
          value={value.direction}
          onChange={(event) => onChange({ direction: event.target.value as 'asc' | 'desc' })}
        >
          <option value="asc">ASC</option>
          <option value="desc" disabled={!options.capabilities.descending}>
            DESC
          </option>
        </select>
      </td>
      <td>
        <input
          type="number"
          aria-label={tConnector('indexPrefixLength', { p0: String(position + 1) })}
          min={1}
          max={3072}
          value={value.prefix ?? ''}
          disabled={disabled || !prefixAllowed}
          placeholder={prefixAllowed ? tConnector('fullColumn') : tConnector('notApplicable')}
          onChange={(event) =>
            onChange({ prefix: event.target.value === '' ? null : Number(event.target.value) })
          }
        />
      </td>
      <td className={styles.keyActions}>
        <button
          type="button"
          aria-label={tConnector('moveIndexColumnUp', { p0: String(position + 1) })}
          disabled={disabled || position === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={13} />
        </button>
        <button
          type="button"
          aria-label={tConnector('moveIndexColumnDown', { p0: String(position + 1) })}
          disabled={disabled || position === selected.length - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={13} />
        </button>
        <button
          type="button"
          aria-label={tConnector('removeIndexColumn', { p0: String(position + 1) })}
          disabled={disabled || selected.length === 1}
          onClick={onDelete}
        >
          <Trash size={13} />
        </button>
      </td>
    </tr>
  );
}
