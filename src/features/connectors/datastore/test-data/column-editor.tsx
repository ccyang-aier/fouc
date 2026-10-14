import { uiText } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './column-editor.messages';
import type { RelationalTableStructure } from '@fouc/shared';
import { LockSimple } from '@phosphor-icons/react/dist/csr/LockSimple';
import { Key } from '@phosphor-icons/react/dist/csr/Key';
import {
  testDataColumnFamily,
  testDataColumnLock,
  testDataNativeUnique,
  type TestDataColumnConfig,
  type TestDataConfig,
  type TestDataGenerator,
} from '@fouc/shared/test-data';
import {
  GeneratorOptions,
  initialGenerator,
  TEST_DATA_GENERATOR_LABELS,
} from './generator-options';
import styles from './test-data.module.css';
export function TestDataColumnEditor({
  structure,
  config,
  selected,
  onSelect,
  onChange,
}: {
  structure: RelationalTableStructure;
  config: TestDataConfig;
  selected: string;
  onSelect: (value: string) => void;
  onChange: (value: TestDataConfig) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  function change(column: string, patch: Partial<TestDataColumnConfig>) {
    onChange({
      ...config,
      columns: config.columns.map((item) =>
        item.column === column ? { ...item, ...patch } : item,
      ),
    });
  }
  const column = structure.columns.find((item) => item.name === selected);
  const item = config.columns.find((item) => item.column === selected);
  const lock = column ? testDataColumnLock(structure, column) : null;
  return (
    <div className={styles.editor}>
      <div className={styles.columnList}>
        <div className={styles.listHeader}>
          <strong>{tConnector('actualTableColumns')}</strong>
          <span>
            {config.columns.filter((entry) => entry.enabled).length} / {structure.columns.length}
            {tConnector('includeInGeneration')}
          </span>
        </div>
        <div className={styles.columnScroll}>
          <table>
            <thead>
              <tr>
                <th>{tConnector('generate')}</th>
                <th>{tConnector('columnType')}</th>
                <th>{tConnector('generator')}</th>
              </tr>
            </thead>
            <tbody>
              {structure.columns.map((target) => {
                const entry = config.columns.find((value) => value.column === target.name)!;
                const reason = testDataColumnLock(structure, target);
                return (
                  <tr
                    key={target.name}
                    data-selected={selected === target.name}
                    data-skipped={!entry.enabled}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={tConnector('generateColumn', { p0: String(target.name) })}
                        checked={entry.enabled}
                        disabled={!!reason}
                        onChange={(event) => change(target.name, { enabled: event.target.checked })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.fieldButton}
                        onClick={() => onSelect(target.name)}
                        aria-pressed={selected === target.name}
                      >
                        <span>
                          {target.isPrimaryKey ? (
                            <Key size={12} />
                          ) : reason ? (
                            <LockSimple size={12} />
                          ) : null}
                          <strong>{target.name}</strong>
                        </span>
                        <small>
                          {target.dataType || tConnector('sqliteDynamicType')}
                          {target.isNullable ? tConnector('nullable') : ' · NOT NULL'}
                        </small>
                      </button>
                    </td>
                    <td>
                      <span className={styles.generatorTag}>
                        {reason
                          ? tConnector('nativeOmit')
                          : entry.enabled
                            ? TEST_DATA_GENERATOR_LABELS(locale)[entry.generator.kind]
                            : tConnector('omit')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <aside className={styles.inspector} aria-label={tConnector('generationColumnConfiguration')}>
        {column && item ? (
          <>
            <header>
              <span>{tConnector('columnConfiguration')}</span>
              <h3>{column.name}</h3>
              <p>{column.dataType || tConnector('sqliteDynamicType')}</p>
            </header>
            {lock ? (
              <div className={styles.locked}>
                <LockSimple size={17} />
                <strong>{uiText(lock, locale)}</strong>
                <p>{tConnector('thisColumnIsNotWrittenDatabaseDefaultsAndGenerationRules')}</p>
              </div>
            ) : (
              <>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(event) => change(column.name, { enabled: event.target.checked })}
                  />
                  {tConnector('includeInGeneration')}
                </label>
                <fieldset disabled={!item.enabled}>
                  <label>
                    {tConnector('generator')}
                    <select
                      aria-label={tConnector('columnGenerator', { p0: String(column.name) })}
                      value={item.generator.kind}
                      onChange={(event) =>
                        change(column.name, {
                          generator: initialGenerator(
                            event.target.value as TestDataGenerator['kind'],
                            column,
                          ),
                        })
                      }
                    >
                      {Object.entries(TEST_DATA_GENERATOR_LABELS(locale))
                        .filter(([kind]) => {
                          const family = testDataColumnFamily(column);
                          return (
                            ['constant', 'enum'].includes(kind) ||
                            (['integer', 'decimal'].includes(family) &&
                              ['integer', 'decimal', 'sequence'].includes(kind)) ||
                            family === kind ||
                            (family === 'text' && ['text', 'name', 'email', 'uuid'].includes(kind))
                          );
                        })
                        .map(([kind, label]) => (
                          <option key={kind} value={kind}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <GeneratorOptions
                    generator={item.generator}
                    onChange={(generator) => change(column.name, { generator })}
                  />
                  <div className={styles.constraintOptions}>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={item.unique}
                        disabled={testDataNativeUnique(structure, column.name)}
                        onChange={(event) => change(column.name, { unique: event.target.checked })}
                      />
                      {tConnector('uniqueWithinBatch')}
                      {testDataNativeUnique(structure, column.name)
                        ? tConnector('nativeConstraint')
                        : ''}
                    </label>
                    <label>
                      {tConnector('nullRatio')}
                      <input
                        aria-label={tConnector('columnNullRatio', { p0: String(column.name) })}
                        type="number"
                        min={0}
                        max={100}
                        value={item.nullPercent}
                        disabled={!column.isNullable}
                        onChange={(event) =>
                          change(column.name, { nullPercent: Number(event.target.value) })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                <div className={styles.nativeFacts}>
                  <span>{tConnector('databaseDefault')}</span>
                  <code>{column.columnDefault ?? tConnector('none')}</code>
                  {column.characterMaximumLength !== null && (
                    <small>
                      {tConnector('maximum')}
                      {column.characterMaximumLength}
                      {tConnector('characters')}
                    </small>
                  )}
                  {column.numericPrecision !== null && (
                    <small>
                      {tConnector('precision')}
                      {column.numericPrecision}
                      {tConnector('decimals')}
                      {column.numericScale ?? tConnector('unknown')}
                    </small>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <p>{tConnector('selectAColumnToConfigureItsGenerator')}</p>
        )}
      </aside>
    </div>
  );
}
