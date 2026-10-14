import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './index-form.messages';
import type { RelationalProvider } from '@fouc/shared';
import type { StructureIndex } from '@fouc/shared/relational-structure-edit';
import styles from './structure-edit.module.css';
export function StructureIndexForm({
  value,
  provider,
  columns,
  onChange,
}: {
  value: StructureIndex;
  provider: RelationalProvider;
  columns: string[];
  onChange: (value: StructureIndex) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const methods =
    provider === 'mysql'
      ? ['btree', 'hash', 'fulltext', 'spatial']
      : provider === 'postgres'
        ? ['btree', 'hash', 'gin', 'gist', 'spgist', 'brin']
        : ['btree'];
  const patch = (values: Partial<StructureIndex>) => onChange({ ...value, ...values });
  return (
    <div className={styles.form}>
      <label>
        {tConnector('indexName')}
        <input
          aria-label={tConnector('editIndexName')}
          value={value.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder={tConnector('forExampleIdxDisplayName')}
        />
      </label>
      <label>
        {tConnector('indexMethod')}
        <select
          value={value.method}
          onChange={(event) => patch({ method: event.target.value as StructureIndex['method'] })}
        >
          {methods.map((method) => (
            <option key={method} value={method}>
              {method.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={value.unique}
          onChange={(event) => patch({ unique: event.target.checked })}
        />
        {tConnector('uniqueIndex')}
        <span>{tConnector('rejectDuplicateKeys')}</span>
      </label>
      <div className={styles.wide}>
        <p className={styles.label}>{tConnector('indexKeyOrder')}</p>
        {value.parts.map((part, position) => (
          <div key={position} className={styles.indexPart}>
            <b>{position + 1}</b>
            <select
              aria-label={tConnector('indexKey', { p0: String(position + 1) })}
              value={part.column}
              onChange={(event) =>
                patch({
                  parts: value.parts.map((entry, i) =>
                    i === position ? { ...entry, column: event.target.value } : entry,
                  ),
                })
              }
            >
              <option value="">{tConnector('selectField')}</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <select
              aria-label={tConnector('indexSortOrder', { p0: String(position + 1) })}
              value={part.descending ? 'desc' : 'asc'}
              onChange={(event) =>
                patch({
                  parts: value.parts.map((entry, i) =>
                    i === position
                      ? { ...entry, descending: event.target.value === 'desc' }
                      : entry,
                  ),
                })
              }
            >
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
            {provider === 'mysql' && (
              <input
                aria-label={tConnector('indexPrefixLength', { p0: String(position + 1) })}
                type="number"
                min={1}
                max={65535}
                value={part.prefixLength ?? ''}
                placeholder={tConnector('prefixLength')}
                onChange={(event) =>
                  patch({
                    parts: value.parts.map((entry, i) =>
                      i === position
                        ? {
                            ...entry,
                            prefixLength: event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          }
                        : entry,
                    ),
                  })
                }
              />
            )}
            <button
              type="button"
              aria-label={tConnector('removeIndexKey', { p0: String(position + 1) })}
              onClick={() => patch({ parts: value.parts.filter((_, i) => i !== position) })}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.subtle}
          onClick={() =>
            patch({
              parts: [
                ...value.parts,
                {
                  column:
                    columns.find((name) => !value.parts.some((part) => part.column === name)) ?? '',
                  descending: false,
                },
              ],
            })
          }
        >
          {tConnector('addIndexKey')}
        </button>
      </div>
      {provider === 'postgres' && (
        <div className={styles.wide}>
          <p className={styles.label}>{tConnector('includeCoveringColumns')}</p>
          <div className={styles.chips}>
            {columns.map((column) => (
              <label key={column}>
                <input
                  type="checkbox"
                  checked={value.include.includes(column)}
                  disabled={value.parts.some((part) => part.column === column)}
                  onChange={(event) =>
                    patch({
                      include: event.target.checked
                        ? [...value.include, column]
                        : value.include.filter((name) => name !== column),
                    })
                  }
                />
                {column}
              </label>
            ))}
          </div>
        </div>
      )}
      {provider !== 'mysql' && (
        <label className={styles.wide}>
          {tConnector('partialIndexWhere')}
          <textarea
            aria-label={tConnector('indexPredicate')}
            value={value.predicate}
            rows={2}
            maxLength={8192}
            onChange={(event) => patch({ predicate: event.target.value })}
            placeholder={tConnector('forExampleDeletedAtIsNullLeaveEmptyToIndex')}
          />
        </label>
      )}
      {provider !== 'sqlite' && (
        <label className={styles.wide}>
          {tConnector('indexComment')}
          <input
            value={value.comment}
            onChange={(event) => patch({ comment: event.target.value })}
          />
        </label>
      )}
      <p className={styles.hint}>{tConnector('commitUsesAStandardIndexBuildWhichMayLockThe')}</p>
    </div>
  );
}
