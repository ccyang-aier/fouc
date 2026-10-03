'use client';

import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { useState } from 'react';
import type { DatabaseExportFormat, DatabaseExportInput, DatabaseExportTableTarget } from '@fouc/shared/database-export';
import styles from './database-export.module.css';

export interface ExportOptionsProps {
  value: DatabaseExportInput;
  schemas: string[];
  tables?: DatabaseExportTableTarget[];
  selectedMode: boolean;
  disabled: boolean;
  onChange(value: DatabaseExportInput): void;
  onSelectedMode(value: boolean): void;
}

const formats: Array<{ value: DatabaseExportFormat; label: string; detail: string; }> = [
  { value: 'sql', label: 'SQL', detail: '原生 DDL / INSERT' },
  { value: 'csv', label: 'CSV', detail: '带标题的分隔文本' },
  { value: 'ndjson', label: 'NDJSON', detail: '每行一个 JSON 对象' },
  { value: 'json', label: 'JSON', detail: '独立完整的 JSON 数组' },
];

export function ExportOptions({ value, schemas, tables, selectedMode, disabled, onChange, onSelectedMode }: ExportOptionsProps) {
  const [search, setSearch] = useState('');
  const change = (patch: Partial<DatabaseExportInput>) => onChange({ ...value, ...patch });
  const visible = tables?.filter(table => value.schemas.includes(table.schema) && `${table.schema}.${table.table}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [];
  const keys = new Set(value.tables.map(table => JSON.stringify([table.schema, table.table])));
  return <div className={styles.options}>
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.step}>01</span>
        <div>
          <h3>选择原生对象范围</h3>
          <p>仅采集当前连接可读取的目录与数据。</p>
        </div>
      </div>
      <div className={styles.schemas} role="group" aria-label="导出 Schema 范围">
        {schemas.map(schema => <label key={schema}>
          <input type="checkbox" disabled={disabled} checked={value.schemas.includes(schema)} onChange={event => {
            const next = event.target.checked ? [...value.schemas, schema] : value.schemas.filter(item => item !== schema);
            change({ schemas: next, tables: value.tables.filter(table => next.includes(table.schema)) });
          }} />
          <span>{schema}
          </span>
        </label>)}
      </div>
      <>
        <div className={styles.segment} role="group" aria-label="导出对象选择方式">
          <button disabled={disabled} data-active={!selectedMode} onClick={() => onSelectedMode(false)}>选中 Schema 全部对象</button>
          <button disabled={disabled} data-active={selectedMode} onClick={() => onSelectedMode(true)}>指定表 / 视图</button>
        </div>
        {selectedMode && <div className={styles.targets}>
          <label className={styles.search}>
            <MagnifyingGlass size={14} />
            <input value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} placeholder="搜索表 / 视图…" aria-label="搜索导出对象" />
          </label>
          <div className={styles.targetList}>{visible.map(table => {
            const key = JSON.stringify([table.schema, table.table]);
            return <label key={key}>
              <input type="checkbox" disabled={disabled} checked={keys.has(key)} onChange={event => change({ tables: event.target.checked ? [...value.tables, table] : value.tables.filter(item => JSON.stringify([item.schema, item.table]) !== key) })} />
              <span>{table.table}
                <small>{table.schema}
                </small>
              </span>
            </label>;
          })}{!visible.length && <p>没有匹配的原生对象。</p>}
          </div>
          <div className={styles.targetFooter}>已选择 {value.tables.length} 个对象<button disabled={disabled || !visible.length} onClick={() => change({ tables: [...new Map([...value.tables, ...visible].map(table => [JSON.stringify([table.schema, table.table]), table])).values()] })}>选择搜索结果</button>
          </div>
        </div>}
      </>
    </section>
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.step}>02</span>
        <div>
          <h3>格式与数据内容</h3>
          <p>保留原始数字文本、二进制与 NULL，避免中途数值转换。</p>
        </div>
      </div>
      <div className={styles.formats} role="group" aria-label="数据库导出格式">{formats.map(format => <button key={format.value} disabled={disabled} data-active={value.format === format.value} onClick={() => change({ format: format.value, includeStructure: format.value === 'sql' ? value.includeStructure : false, includeData: format.value !== 'sql' || value.includeData })}>
        <strong>{format.label}
        </strong>
        <small>{format.detail}
        </small>
      </button>)}
      </div>
      {value.format === 'sql' ? <div className={styles.checks}>
        <label>
          <input type="checkbox" checked={value.includeStructure} disabled={disabled} onChange={event => change({ includeStructure: event.target.checked })} />结构 DDL</label>
        <label>
          <input type="checkbox" checked={value.includeData} disabled={disabled} onChange={event => change({ includeData: event.target.checked })} />表数据 INSERT</label>
      </div> : <p className={styles.helper}>{value.format === 'csv' ? 'NULL 使用未加引号的 \\N；空字符串与文本 \\N 会加引号。CSV 类型信息位于 ZIP 清单。' : '原生 JSON / 数组列保留为原始文本，二进制附带 Base64 类型标记；大整数数值字面量需要无损 JSON 读取端。'}
      </p>}
      <div className={styles.fieldGrid}>
        <label>
          <span>实际行范围</span>
          <select disabled={disabled} value={value.rowLimit === null ? 'all' : 'limited'} onChange={event => change({ rowLimit: event.target.value === 'all' ? null : 5000 })}>
            <option value="all">每表全部行</option>
            <option value="limited">明确限制每表前 N 行</option>
          </select>
        </label>{value.rowLimit !== null && <label>
          <span>每表最多行数</span>
          <input type="number" min={1} max={100000000} disabled={disabled} value={value.rowLimit} onChange={event => change({ rowLimit: event.target.valueAsNumber })} />
        </label>}
        <label>
          <span>分页缓冲</span>
          <select disabled={disabled} value={value.pageSize} onChange={event => change({ pageSize: Number(event.target.value) })}>
            <option value={100}>100 行 / 页</option>
            <option value={500}>500 行 / 页</option>
            <option value={1000}>1000 行 / 页</option>
          </select>
        </label>
      </div>
    </section>
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.step}>03</span>
        <div>
          <h3>文件与分包</h3>
          <p>设备流式写入 · 完成后下载 · 单次最大 1 GiB。</p>
        </div>
      </div>
      <div className={styles.fieldGrid}>
        <label>
          <span>封装方式</span>
          <select disabled={disabled} value={value.packaging} onChange={event => change({ packaging: event.target.value as DatabaseExportInput['packaging'], partMiB: event.target.value === 'file' ? null : 64 })}>
            <option value="zip">ZIP + 类型 / 范围清单</option>
            <option value="file">单文件</option>
          </select>
        </label>{value.packaging === 'zip' && <label>
          <span>目标分包大小</span>
          <select disabled={disabled} value={value.partMiB ?? 'none'} onChange={event => change({ partMiB: event.target.value === 'none' ? null : Number(event.target.value) })}>
            <option value={16}>16 MiB</option>
            <option value={64}>64 MiB</option>
            <option value={128}>128 MiB</option>
            <option value={256}>256 MiB</option>
            <option value="none">每表不分包</option>
          </select>
        </label>}
      </div>
      <p className={styles.helper}>{value.packaging === 'zip' ? '标准 ZIP STORE 不压缩；每个 JSON 分包可独立读取，CSV 分包均含标题。单个超大行 / SQL 语句保持完整。' : 'CSV / JSON / NDJSON 单文件只支持一个对象；多表请使用 ZIP。单文件不包含类型清单。'}
      </p>
    </section>
  </div>;
}
