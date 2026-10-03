import type { RelationalProvider } from '@fouc/shared';
import type { StructureIndex } from '@fouc/shared/relational-structure-edit';
import styles from './structure-edit.module.css';

export function StructureIndexForm({ value, provider, columns, onChange }: { value: StructureIndex; provider: RelationalProvider; columns: string[]; onChange: (value: StructureIndex) => void }) {
  const methods = provider === 'mysql' ? ['btree', 'hash', 'fulltext', 'spatial'] : provider === 'postgres' ? ['btree', 'hash', 'gin', 'gist', 'spgist', 'brin'] : ['btree'];
  const patch = (values: Partial<StructureIndex>) => onChange({ ...value, ...values });
  return <div className={styles.form}><label>索引名称<input aria-label="编辑索引名称" value={value.name} onChange={(event) => patch({ name: event.target.value })} placeholder="例如 idx_display_name" /></label>
    <label>索引方法<select value={value.method} onChange={(event) => patch({ method: event.target.value as StructureIndex['method'] })}>{methods.map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}</select></label>
    <label className={styles.check}><input type="checkbox" checked={value.unique} onChange={(event) => patch({ unique: event.target.checked })} />唯一索引<span>拒绝重复键</span></label>
    <div className={styles.wide}><p className={styles.label}>索引键顺序</p>{value.parts.map((part, position) => <div key={position} className={styles.indexPart}><b>{position + 1}</b><select aria-label={`索引键 ${position + 1}`} value={part.column} onChange={(event) => patch({ parts: value.parts.map((entry, i) => i === position ? { ...entry, column: event.target.value } : entry) })}><option value="">选择字段</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select>
      <select aria-label={`索引排序 ${position + 1}`} value={part.descending ? 'desc' : 'asc'} onChange={(event) => patch({ parts: value.parts.map((entry, i) => i === position ? { ...entry, descending: event.target.value === 'desc' } : entry) })}><option value="asc">ASC</option><option value="desc">DESC</option></select>
      {provider === 'mysql' && <input aria-label={`索引前缀长度 ${position + 1}`} type="number" min={1} max={65535} value={part.prefixLength ?? ''} placeholder="前缀长度" onChange={(event) => patch({ parts: value.parts.map((entry, i) => i === position ? { ...entry, prefixLength: event.target.value ? Number(event.target.value) : undefined } : entry) })} />}
      <button type="button" aria-label={`移除索引键 ${position + 1}`} onClick={() => patch({ parts: value.parts.filter((_, i) => i !== position) })}>×</button></div>)}<button type="button" className={styles.subtle} onClick={() => patch({ parts: [...value.parts, { column: columns.find((name) => !value.parts.some((part) => part.column === name)) ?? '', descending: false }] })}>＋ 添加索引键</button></div>
    {provider === 'postgres' && <div className={styles.wide}><p className={styles.label}>INCLUDE 覆盖字段</p><div className={styles.chips}>{columns.map((column) => <label key={column}><input type="checkbox" checked={value.include.includes(column)} disabled={value.parts.some((part) => part.column === column)} onChange={(event) => patch({ include: event.target.checked ? [...value.include, column] : value.include.filter((name) => name !== column) })} />{column}</label>)}</div></div>}
    {provider !== 'mysql' && <label className={styles.wide}>条件索引 WHERE<textarea aria-label="索引条件" value={value.predicate} rows={2} maxLength={8192} onChange={(event) => patch({ predicate: event.target.value })} placeholder="例如 deleted_at IS NULL；留空表示全表索引" /></label>}
    {provider !== 'sqlite' && <label className={styles.wide}>索引注释<input value={value.comment} onChange={(event) => patch({ comment: event.target.value })} /></label>}
    <p className={styles.hint}>提交采用普通索引构建，可能锁表。扩展 opclass、表达式索引和 CONCURRENTLY 请通过 DDL 审查处理。</p>
  </div>;
}
