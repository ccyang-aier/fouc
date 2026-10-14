'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './column-row.messages';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import type { RelationalProvider } from '@fouc/shared';
import {
  tableCreateDefaultFunctions,
  tableCreateTypes,
  type TableCreateColumn,
} from '@fouc/shared/table-create';
import styles from './table-create.module.css';
export function TableCreateColumnRow({
  column,
  index,
  count,
  provider,
  disabled,
  onChange,
  onDelete,
  onMove,
}: {
  column: TableCreateColumn;
  index: number;
  count: number;
  provider: RelationalProvider;
  disabled: boolean;
  onChange: (column: TableCreateColumn) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const types = tableCreateTypes[provider],
    type = types.find((item) => item.name === column.type)!;
  const functions = tableCreateDefaultFunctions(provider, column.type);
  const label = tConnector('column', { p0: String(index + 1) });
  const update = (patch: Partial<TableCreateColumn>) => onChange({ ...column, ...patch });
  function changeType(name: string) {
    const next = types.find((item) => item.name === name)!;
    update({
      type: name,
      length: next.parameter === 'length' ? Math.min(255, next.maximumLength!) : null,
      precision: next.parameter === 'decimal' && provider !== 'sqlite' ? 20 : null,
      scale: next.parameter === 'decimal' && provider !== 'sqlite' ? 4 : null,
      identity: 'none',
      default: { kind: 'none' },
    });
  }
  return (
    <tr>
      <td className={styles.columnName}>
        <span>{index + 1}</span>
        <input
          aria-label={tConnector('name', { p0: String(label) })}
          value={column.name}
          disabled={disabled}
          placeholder={tConnector('columnName')}
          onChange={(event) => update({ name: event.target.value })}
        />
      </td>
      <td>
        <select
          aria-label={tConnector('type', { p0: String(label) })}
          value={column.type}
          disabled={disabled}
          onChange={(event) => changeType(event.target.value)}
        >
          {types.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </td>
      <td className={styles.parameter}>
        {type.parameter === 'length' ? (
          <input
            type="number"
            aria-label={tConnector('length', { p0: String(label) })}
            min={1}
            max={type.maximumLength}
            value={column.length ?? ''}
            disabled={disabled}
            onChange={(event) =>
              update({ length: event.target.value ? Number(event.target.value) : null })
            }
          />
        ) : type.parameter === 'decimal' && provider !== 'sqlite' ? (
          <div>
            <input
              type="number"
              aria-label={tConnector('precision', { p0: String(label) })}
              min={1}
              max={provider === 'mysql' ? 65 : 1000}
              value={column.precision ?? ''}
              disabled={disabled}
              onChange={(event) =>
                update({ precision: event.target.value ? Number(event.target.value) : null })
              }
            />
            <span>,</span>
            <input
              type="number"
              aria-label={tConnector('decimalPlaces', { p0: String(label) })}
              min={0}
              max={provider === 'mysql' ? 30 : (column.precision ?? 1000)}
              value={column.scale ?? ''}
              disabled={disabled}
              onChange={(event) =>
                update({ scale: event.target.value ? Number(event.target.value) : null })
              }
            />
          </div>
        ) : (
          <span className={styles.dash}>—</span>
        )}
      </td>
      <td className={styles.flag}>
        <input
          type="checkbox"
          aria-label={tConnector('allowsNull', { p0: String(label) })}
          checked={column.nullable}
          disabled={disabled || column.primaryKey || column.identity !== 'none'}
          onChange={(event) => update({ nullable: event.target.checked })}
        />
      </td>
      <td className={styles.flag}>
        <input
          type="checkbox"
          aria-label={tConnector('primaryKey', { p0: String(label) })}
          checked={column.primaryKey}
          disabled={disabled}
          onChange={(event) =>
            update({
              primaryKey: event.target.checked,
              ...(event.target.checked
                ? { nullable: false }
                : provider !== 'postgres'
                  ? { identity: 'none' as const }
                  : {}),
            })
          }
        />
      </td>
      <td className={styles.flag}>
        <input
          type="checkbox"
          aria-label={tConnector('unique', { p0: String(label) })}
          checked={column.unique}
          disabled={disabled}
          onChange={(event) => update({ unique: event.target.checked })}
        />
      </td>
      <td>
        <select
          aria-label={tConnector('autoIncrementMode', { p0: String(label) })}
          value={column.identity}
          disabled={disabled || type.family !== 'integer'}
          onChange={(event) =>
            update({
              identity: event.target.value as TableCreateColumn['identity'],
              ...(event.target.value !== 'none'
                ? {
                    nullable: false,
                    default: { kind: 'none' as const },
                    ...(provider !== 'postgres' ? { primaryKey: true } : {}),
                  }
                : {}),
            })
          }
        >
          <option value="none">{tConnector('none')}</option>
          {provider === 'postgres' ? (
            <>
              <option value="by-default">Identity · BY DEFAULT</option>
              <option value="always">Identity · ALWAYS</option>
            </>
          ) : (
            <option value="auto">
              {provider === 'sqlite' ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'}
            </option>
          )}
        </select>
      </td>
      <td className={styles.defaults}>
        <select
          aria-label={tConnector('defaultValueMode', { p0: String(label) })}
          disabled={disabled || column.identity !== 'none'}
          value={column.default.kind}
          onChange={(event) =>
            update({
              default:
                event.target.value === 'none'
                  ? { kind: 'none' }
                  : event.target.value === 'null'
                    ? { kind: 'null' }
                    : event.target.value === 'function'
                      ? { kind: 'function', value: functions[0] }
                      : { kind: 'literal', value: '' },
            })
          }
        >
          <option value="none">{tConnector('unset')}</option>
          <option value="null" disabled={!column.nullable}>
            NULL
          </option>
          <option value="literal">{tConnector('literal')}</option>
          {functions.length > 0 && (
            <option value="function">{tConnector('builtInFunction')}</option>
          )}
        </select>
        {column.default.kind === 'literal' ? (
          <input
            aria-label={tConnector('defaultLiteral', { p0: String(label) })}
            value={column.default.value}
            disabled={disabled}
            placeholder={
              type.family === 'binary'
                ? tConnector('hexadecimalBytes')
                : type.family === 'datetime'
                  ? tConnector('utcTimeZ')
                  : tConnector('rawValueDoNotEnterSql')
            }
            onChange={(event) =>
              update({ default: { kind: 'literal', value: event.target.value } })
            }
          />
        ) : column.default.kind === 'function' ? (
          <select
            aria-label={tConnector('defaultFunction', { p0: String(label) })}
            value={column.default.value}
            disabled={disabled}
            onChange={(event) =>
              update({ default: { kind: 'function', value: event.target.value } })
            }
          >
            {functions.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        ) : null}
      </td>
      <td className={styles.rowActions}>
        <button
          type="button"
          title={tConnector('moveColumnUp')}
          aria-label={tConnector('moveUp', { p0: String(label) })}
          disabled={disabled || index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={13} />
        </button>
        <button
          type="button"
          title={tConnector('moveColumnDown')}
          aria-label={tConnector('moveDown', { p0: String(label) })}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={13} />
        </button>
        <button
          type="button"
          title={tConnector('deleteColumn')}
          aria-label={tConnector('delete', { p0: String(label) })}
          disabled={disabled || count === 1}
          onClick={onDelete}
        >
          <Trash size={14} />
        </button>
      </td>
    </tr>
  );
}
