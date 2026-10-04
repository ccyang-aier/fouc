'use client';

import {
  MONGO_TABULAR_TYPES, validateMongoTabularFields,
  type MongoTabularSource, type MongoTabularOptions, type MongoTabularField, type MongoTabularType,
} from '@fouc/shared/mongo-tabular';
import styles from './transfer.module.css';

export const TABULAR_TYPE_LABELS: Record<MongoTabularType, string> = {
  string: 'String · 原文', objectId: 'ObjectId', int32: 'Int32', int64: 'Int64 · 精确整数',
  decimal128: 'Decimal128 · 精确小数', double: 'Double · 浮点', date: 'Date · 明确时区', boolean: 'Boolean', ejson: 'Canonical EJSON',
};

export function MongoTabularConfiguration({ options, parsed, fields, disabled, idPolicy, onOptions, onFields }: {
  options: MongoTabularOptions;
  parsed: MongoTabularSource | null;
  fields: MongoTabularField[];
  disabled: boolean;
  idPolicy: 'generate' | 'preserve';
  onOptions: (options: MongoTabularOptions) => void;
  onFields: (fields: MongoTabularField[]) => void;
}) {
  let mappingError = '';
  if (parsed && !parsed.errors.length) {
    try { validateMongoTabularFields(fields, parsed.columns.length); }
    catch (error) { mappingError = error instanceof Error ? error.message : String(error); }
  }
  function change(index: number, patch: Partial<MongoTabularField>) {
    onFields(fields.map(field => field.sourceIndex === index ? { ...field, ...patch } : field));
  }
  return <section className={styles.tabularConfig} aria-label="CSV 与 TSV 字段配置">
    <div className={styles.options}>
      <label><span>分隔符</span><select aria-label="表格分隔符" disabled={disabled} value={options.delimiter} onChange={event => onOptions({ ...options, delimiter: event.target.value })}>
        <option value=",">逗号 ,</option><option value={'\t'}>Tab 制表符</option><option value=";">分号 ;</option><option value="|">竖线 |</option>
      </select></label>
      <label><span>NULL 标记 · 可留空</span><input aria-label="表格 NULL 标记" disabled={disabled} value={options.nullToken} maxLength={64} placeholder={'例如 \\N'} onChange={event => onOptions({ ...options, nullToken: event.target.value })} /><small>只匹配未加引号的原文；加引号的标记仍为字符串。</small></label>
    </div>
    <div className={styles.parseFlags}>
      <label><input type="checkbox" aria-label="首行包含字段名" disabled={disabled} checked={options.header} onChange={event => onOptions({ ...options, header: event.target.checked })} />首行包含字段名</label>
      <label><input type="checkbox" disabled={disabled} checked={options.trimValues} onChange={event => onOptions({ ...options, trimValues: event.target.checked })} />去除值两端空白</label>
      <label><input type="checkbox" disabled={disabled} checked={options.emptyAsNull} onChange={event => onOptions({ ...options, emptyAsNull: event.target.checked })} />空字符串转 NULL</label>
      <label><input type="checkbox" aria-label="建议识别 24 位十六进制 ObjectId" disabled={disabled} checked={options.recognizeObjectIdHex} onChange={event => onOptions({ ...options, recognizeObjectIdHex: event.target.checked })} />建议识别 24 位 ObjectId</label>
    </div>
    {parsed?.errors.map((error, index) => <p className={styles.error} role="alert" key={index}>源物理行 {error.line}，列 {error.column}：{error.message}</p>)}
    {parsed && !parsed.errors.length && <>
      <div className={styles.mappingHeading}><div><strong>{parsed.rows.length} 行 · {parsed.columns.length} 列</strong><small>前 {parsed.sampledRows} 行给出建议，预览会验证全部数据。</small></div><button type="button" disabled={disabled} onClick={() => onFields(fields.map(field => ({ ...field, type: parsed.suggestions[field.sourceIndex].type })))}>应用采样类型建议</button></div>
      <div className={styles.mappingGrid} aria-label="源字段到 BSON 映射">
        <div className={styles.mappingGridHeader}><span>源字段 / 原文样本</span><span>JSON Pointer 目标</span><span>写入 BSON 类型</span><span>映射</span></div>
        {fields.map(field => {
          const suggestion = parsed.suggestions[field.sourceIndex];
          return <div key={field.sourceIndex} className={styles.mappingRow}>
            <div className={styles.sourceColumn}><strong>{field.sourceIndex + 1}. {parsed.columns[field.sourceIndex]}</strong><small title={suggestion.samples.join('\n')}>{suggestion.samples.map(value => value.length > 80 ? value.slice(0, 80) + '…' : value).join(' · ') || 'NULL / 缺失'}</small><small>建议 {TABULAR_TYPE_LABELS[suggestion.type]}{suggestion.objectIdCandidate && !options.recognizeObjectIdHex ? ' · ObjectId 候选' : ''}</small></div>
            <label><span className={styles.mobileLabel}>目标路径</span><input aria-label={`列 ${field.sourceIndex + 1} 目标路径`} disabled={disabled || field.target === null} value={field.target ?? ''} placeholder="/items/0/name" spellCheck={false} onChange={event => change(field.sourceIndex, { target: event.target.value })} /></label>
            <label><span className={styles.mobileLabel}>BSON 类型</span><select aria-label={`列 ${field.sourceIndex + 1} BSON 类型`} disabled={disabled || field.target === null} value={field.type} onChange={event => change(field.sourceIndex, { type: event.target.value as MongoTabularType })}>{MONGO_TABULAR_TYPES.map(type => <option value={type} key={type}>{TABULAR_TYPE_LABELS[type]}</option>)}</select></label>
            <label className={styles.mapToggle}><input type="checkbox" aria-label={`映射列 ${field.sourceIndex + 1}`} disabled={disabled || (idPolicy === 'generate' && parsed.columns[field.sourceIndex] === '_id')} checked={field.target !== null} onChange={event => change(field.sourceIndex, { target: event.target.checked ? '/' + parsed.columns[field.sourceIndex].replace(/~/g, '~0').replace(/\//g, '~1') : null })} />{field.target === null ? '跳过' : '映射'}</label>
          </div>;
        })}
      </div>
      {mappingError && <p className={styles.error} role="alert">映射无效：{mappingError}</p>}
      <p className={styles.notice}>标题按列序号识别，空名或重名会生成唯一列名。目标字段默认使用完整标题字面值；嵌套请明确填写 /address/city 或 /items/0/name。数组索引须从 0 连续开始，最大 255。短行缺失字段省略，显式 NULL 写入 null。</p>
      {fields.some(field => field.target !== null && field.type === 'double') && <p className={styles.notice}>Double 使用 IEEE 754 浮点，可能丢失精度。大整数请选 Int64；精确小数请选 Decimal128，二者保留源数字原文。</p>}
    </>}
  </section>;
}

export function MongoTabularMappingReview({ fields, parsed }: { fields: MongoTabularField[]; parsed: MongoTabularSource }) {
  return <details className={styles.mappingReview} open>
    <summary>已冻结字段映射 · {fields.filter(field => field.target !== null).length} 列 · 采样建议已明确确认</summary>
    <div>{fields.filter(field => field.target !== null).map(field => <p key={field.sourceIndex}><span>{parsed.columns[field.sourceIndex]}</span><code>→ {field.target}</code><small>{TABULAR_TYPE_LABELS[field.type]}</small></p>)}</div>
  </details>;
}
