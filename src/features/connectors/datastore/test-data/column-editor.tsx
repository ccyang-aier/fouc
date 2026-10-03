import type { RelationalTableStructure } from '@fouc/shared';
import { LockSimple } from '@phosphor-icons/react/dist/csr/LockSimple';
import { Key } from '@phosphor-icons/react/dist/csr/Key';
import { testDataColumnFamily, testDataColumnLock, testDataNativeUnique, type TestDataColumnConfig, type TestDataConfig, type TestDataGenerator } from '@fouc/shared/test-data';
import { GeneratorOptions, initialGenerator, TEST_DATA_GENERATOR_LABELS } from './generator-options';
import styles from './test-data.module.css';

export function TestDataColumnEditor({ structure, config, selected, onSelect, onChange }: {
  structure: RelationalTableStructure;
  config: TestDataConfig;
  selected: string;
  onSelect: (value: string) => void;
  onChange: (value: TestDataConfig) => void;
}) {
  function change(column: string, patch: Partial<TestDataColumnConfig>) {
    onChange({ ...config, columns: config.columns.map(item => item.column === column ? { ...item, ...patch } : item) });
  }
  const column = structure.columns.find(item => item.name === selected);
  const item = config.columns.find(item => item.column === selected);
  const lock = column ? testDataColumnLock(structure, column) : null;
  return <div className={styles.editor}>
    <div className={styles.columnList}>
      <div className={styles.listHeader}><strong>真实表字段</strong><span>{config.columns.filter(entry => entry.enabled).length} / {structure.columns.length} 参与生成</span></div>
      <div className={styles.columnScroll}><table><thead><tr><th>生成</th><th>字段 / 类型</th><th>生成器</th></tr></thead><tbody>
        {structure.columns.map(target => {
          const entry = config.columns.find(value => value.column === target.name)!;
          const reason = testDataColumnLock(structure, target);
          return <tr key={target.name} data-selected={selected === target.name} data-skipped={!entry.enabled}>
            <td><input type="checkbox" aria-label={`生成字段 ${target.name}`} checked={entry.enabled} disabled={!!reason} onChange={event => change(target.name, { enabled: event.target.checked })}/></td>
            <td><button type="button" className={styles.fieldButton} onClick={() => onSelect(target.name)} aria-pressed={selected === target.name}>
              <span>{target.isPrimaryKey ? <Key size={12}/> : reason ? <LockSimple size={12}/> : null}<strong>{target.name}</strong></span>
              <small>{target.dataType || 'SQLite 动态类型'}{target.isNullable ? ' · 可空' : ' · NOT NULL'}</small>
            </button></td>
            <td><span className={styles.generatorTag}>{reason ? '原生 / 省略' : entry.enabled ? TEST_DATA_GENERATOR_LABELS[entry.generator.kind] : '省略'}</span></td>
          </tr>;
        })}
      </tbody></table></div>
    </div>
    <aside className={styles.inspector} aria-label="生成字段配置">
      {column && item ? <>
        <header><span>字段配置</span><h3>{column.name}</h3><p>{column.dataType || 'SQLite 动态类型'}</p></header>
        {lock ? <div className={styles.locked}><LockSimple size={17}/><strong>{lock}</strong><p>不写入此字段。数据库默认值与生成规则会在原生追加事务中生效；没有默认值的必填字段将阻止整批生成。</p></div> : <>
          <label className={styles.checkbox}><input type="checkbox" checked={item.enabled} onChange={event => change(column.name, { enabled: event.target.checked })}/>参与生成</label>
          <fieldset disabled={!item.enabled}>
            <label>生成器<select aria-label={`字段 ${column.name} 生成器`} value={item.generator.kind} onChange={event => change(column.name, { generator: initialGenerator(event.target.value as TestDataGenerator['kind'], column) })}>
              {Object.entries(TEST_DATA_GENERATOR_LABELS).filter(([kind]) => {
                const family = testDataColumnFamily(column);
                return ['constant', 'enum'].includes(kind) || (['integer', 'decimal'].includes(family) && ['integer', 'decimal', 'sequence'].includes(kind)) || family === kind || (family === 'text' && ['text', 'name', 'email', 'uuid'].includes(kind));
              }).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
            </select></label>
            <GeneratorOptions generator={item.generator} onChange={generator => change(column.name, { generator })}/>
            <div className={styles.constraintOptions}>
              <label className={styles.checkbox}><input type="checkbox" checked={item.unique} disabled={testDataNativeUnique(structure, column.name)} onChange={event => change(column.name, { unique: event.target.checked })}/>本批唯一{testDataNativeUnique(structure, column.name) ? ' · 原生约束' : ''}</label>
              <label>NULL 比例 (%)<input aria-label={`字段 ${column.name} NULL 比例`} type="number" min={0} max={100} value={item.nullPercent} disabled={!column.isNullable} onChange={event => change(column.name, { nullPercent: Number(event.target.value) })}/></label>
            </div>
          </fieldset>
          <div className={styles.nativeFacts}><span>数据库默认值</span><code>{column.columnDefault ?? '无'}</code>{column.characterMaximumLength !== null && <small>最大 {column.characterMaximumLength} 个字符</small>}{column.numericPrecision !== null && <small>精度 {column.numericPrecision} / 小数 {column.numericScale ?? '未知'}</small>}</div>
        </>}
      </> : <p>选择字段配置生成器。</p>}
    </aside>
  </div>;
}
