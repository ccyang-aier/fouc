'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Plus } from '@phosphor-icons/react/dist/csr/Plus'
import { Trash } from '@phosphor-icons/react/dist/csr/Trash'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'
import { INDEX_EDIT_LIMITS, indexEditDropReason, validateIndexEditInput, type IndexEditInput, type IndexEditKey, type IndexEditOptions } from '@fouc/shared/index-edit'
import { IndexKeyRow } from './key-row'
import styles from './index-edit.module.css'

export function IndexDesigner({ options, busy, onPreview, onClose, children }: { options: IndexEditOptions; busy: boolean; onPreview: (input: IndexEditInput) => Promise<void>; onClose: () => void; children?: ReactNode }) {
  const { structure, capabilities, provider } = options
  const [operation, setOperation] = useState<'create' | 'drop'>('create')
  const [name, setName] = useState('')
  const [unique, setUnique] = useState(false), [nullsNotDistinct, setNullsNotDistinct] = useState(false)
  const [columns, setColumns] = useState<IndexEditKey[]>(() => structure.columns.length ? [{ column: structure.columns[0].name, direction: 'asc', prefix: null }] : [])
  const [include, setInclude] = useState<string[]>([]), [drop, setDrop] = useState('')
  const input = useMemo<IndexEditInput>(() => operation === 'drop'
    ? { operation, schema: structure.schema, table: structure.table, name: drop }
    : { operation, schema: structure.schema, table: structure.table, name, unique, columns, include, nullsNotDistinct }, [operation, structure.schema, structure.table, drop, name, unique, columns, include, nullsNotDistinct])
  const validation = useMemo(() => {
    try { validateIndexEditInput(options, input); return '' }
    catch (reason) { return reason instanceof Error ? reason.message : String(reason) }
  }, [options, input])
  function update(position: number, patch: Partial<IndexEditKey>) { setColumns(current => current.map((key, index) => index === position ? { ...key, ...patch } : key)) }
  function move(position: number, delta: -1 | 1) {
    setColumns(current => { const next = [...current], target = position + delta; [next[position], next[target]] = [next[target], next[position]]; return next })
  }
  const selected = structure.indexes.find(index => index.name === drop)
  return <>
    <div className={styles.body}>
    <div className={styles.layout}>
      <aside className={styles.inventory} aria-label="当前原生索引">
        <div className={styles.inventoryHead}><strong>当前索引</strong><span>{structure.indexes.length}</span></div>
        <div className={styles.indexList}>
          {structure.indexes.map(index => {
            const reason = indexEditDropReason(provider, index, structure)
            const fields = index.parts.filter(part => part.role === 'key').map(part => part.column ?? part.expression ?? '原生表达式').join(', ')
            return <button key={index.name} type="button" disabled={busy || Boolean(reason)} aria-label={`选择删除索引 ${index.name}`} title={reason ?? `审查删除 ${index.name}`} aria-pressed={operation === 'drop' && drop === index.name} onClick={() => { setOperation('drop'); setDrop(index.name) }}>
              <span><strong>{index.name}</strong><small>{index.primary ? 'PK' : index.unique ? 'UNIQUE' : index.method.toUpperCase()}</small></span>
              <code>{fields || '原生键定义'}</code>{reason && <em>{reason}</em>}
            </button>
          })}
          {!structure.indexes.length && <p className={styles.empty}>当前表没有索引。</p>}
        </div>
        <p className={styles.inventoryHint}>主键及原生约束索引受保护。选择独立索引可审查删除操作。</p>
      </aside>
      <section className={styles.design} aria-label="索引设计">
        <div className={styles.tabs} role="tablist" aria-label="索引操作">
          <button type="button" role="tab" aria-selected={operation === 'create'} disabled={busy} onClick={() => setOperation('create')}><Plus size={13} />创建索引</button>
          <button type="button" role="tab" aria-selected={operation === 'drop'} disabled={busy} onClick={() => setOperation('drop')}><Trash size={13} />删除索引</button>
        </div>
        {operation === 'create' ? <>
          <div className={styles.nameRow}><label>索引名称<input aria-label="新索引名称" value={name} autoFocus disabled={busy} placeholder="例如：idx_orders_created" onChange={event => setName(event.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={unique} disabled={busy} onChange={event => { setUnique(event.target.checked); if (!event.target.checked) setNullsNotDistinct(false) }} />唯一索引</label></div>
          <div className={styles.sectionHead}><strong>索引键 <small>{columns.length} / {INDEX_EDIT_LIMITS.keys}</small></strong><button type="button" disabled={busy || columns.length >= INDEX_EDIT_LIMITS.keys || columns.length >= structure.columns.length} onClick={() => { const next = structure.columns.find(column => !columns.some(key => key.column === column.name) && !include.includes(column.name)); if (next) setColumns(current => [...current, { column: next.name, direction: 'asc', prefix: null }]) }}><Plus size={13} />添加字段</button></div>
          <div className={styles.keysViewport}>
            <table className={styles.keys}>
              <thead><tr><th>#</th><th>真实字段</th><th>排序</th><th>前缀长度</th><th>顺序 / 删除</th></tr></thead>
              <tbody>{columns.map((key, position) => <IndexKeyRow key={position} position={position} value={key}
                options={options} selected={columns} include={include} disabled={busy}
                onChange={patch => update(position, patch)} onMove={delta => move(position, delta)}
                onDelete={() => setColumns(current => current.filter((_, index) => index !== position))} />)}</tbody>
            </table>
          </div>
          <p className={styles.hint}>字段顺序决定复合索引的前导键。{provider === 'mysql' ? '字符前缀按字符计，二进制按字节；TEXT / BLOB 需明确前缀。' : '索引键使用原生默认排序规则。'}</p>
          <div className={styles.advanced}>
            <label className={styles.check} title={capabilities.nullsNotDistinct ? '多个 NULL 视为相同值' : '仅 PostgreSQL 15+ 支持'}>
              <input type="checkbox" checked={nullsNotDistinct} disabled={busy || !unique || !capabilities.nullsNotDistinct}
                onChange={event => setNullsNotDistinct(event.target.checked)} />
              NULLS NOT DISTINCT <small>{capabilities.nullsNotDistinct ? '唯一索引' : '当前不支持'}</small>
            </label>
            <strong>INCLUDE <small>{capabilities.include ? '仅存储，不参与唯一性' : '当前原生版本不支持'}</small></strong>
            {capabilities.include && <div className={styles.includeFields}>
              {structure.columns.map(column => <label key={column.name} className={styles.check}>
                <input type="checkbox" checked={include.includes(column.name)}
                  disabled={busy || columns.some(key => key.column === column.name) || !include.includes(column.name) && include.length >= INDEX_EDIT_LIMITS.include}
                  onChange={event => setInclude(current => event.target.checked ? [...current, column.name] : current.filter(name => name !== column.name))} />
                {column.name}
              </label>)}
            </div>}
          </div>
        </> : <div className={styles.dropForm}>
          <label>待删除的独立索引
            <select aria-label="待删除索引" value={drop} disabled={busy} onChange={event => setDrop(event.target.value)}>
              <option value="">选择索引</option>
              {structure.indexes.map(index => <option key={index.name}
                disabled={Boolean(indexEditDropReason(provider, index, structure))} value={index.name}>
                {index.name}{index.primary ? ' · 主键' : index.unique ? ' · UNIQUE' : ''}
              </option>)}
            </select>
          </label>
          {selected && <>
            <div className={styles.dropDetail}>
              <strong>{selected.name}</strong>
              <span>{selected.method.toUpperCase()} · {selected.unique ? '唯一' : '非唯一'}</span>
              <code>{selected.parts.filter(part => part.role === 'key').map(part => `${part.column ?? part.expression ?? '原生表达式'}${part.descending ? ' DESC' : ''}`).join(', ')}</code>
            </div>
            <p className={styles.danger}><Warning size={16} />删除不可撤销，可能降低查询性能；删除独立唯一索引会移除其唯一性约束。</p>
          </>}
        </div>}
        {validation && (name || drop || options.permission === 'denied') && <p className={styles.validation} role="status"><Warning size={14} />{validation}</p>}
      </section>
    </div>
    <div className={styles.notices}>{options.warnings.map(message => <p key={message}>{message}</p>)}</div>
    {children}
    </div>
    <footer className={styles.footer}><button type="button" onClick={onClose}>关闭</button><small>审查阶段不执行 DDL</small><span /><button className={styles.primary} type="button" disabled={busy || Boolean(validation)} onClick={() => void onPreview(input)}>{busy ? '正在准备…' : operation === 'drop' ? '审查危险删除' : '生成 DDL 审查'}</button></footer>
  </>
}
