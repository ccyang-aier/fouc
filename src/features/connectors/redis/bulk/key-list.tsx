'use client'

import { useState } from 'react'
import { Key, Stack } from '@phosphor-icons/react'
import type { RedisKeyInfo } from '@fouc/shared'
import type { RedisBulkResult } from '@fouc/shared/redis-bulk'
import { redisTtl } from '../redis-value-viewer'
import { RedisBulkDialog } from './dialog'
import styles from './bulk.module.css'

type Props = {
  base: string
  database: number
  keys: RedisKeyInfo[]
  selected: string | null
  disabled: boolean
  readOnly: boolean
  onSelect: (key: string) => void
  onUnlock: () => Promise<void>
  onBusyChange: (busy: boolean) => void
  onApplied: (result: RedisBulkResult) => void
}

export function RedisBulkKeyList(props: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [frozen, setFrozen] = useState<string[] | null>(null)
  const loaded = props.keys.map(key => key.key.rawBase64)
  const selected = loaded.filter(key => checked.has(key))
  const allChecked = loaded.length > 0 && selected.length === loaded.length
  function toggle(key: string, value: boolean) {
    setChecked(new Set(value ? [...selected, key] : selected.filter(raw => raw !== key)))
  }
  function applied(result: RedisBulkResult) {
    const completed = new Set(result.keys.filter(key => ['applied', 'unchanged', 'missing'].includes(key.state)).map(key => key.key.rawBase64))
    setChecked(current => new Set([...current].filter(key => !completed.has(key))))
    props.onApplied(result)
  }
  return <>
    <div className={styles.selectionBar}>
      <label title={loaded.length > 100 ? '已加载超过 100 个 Key，请逐个选择最多 100 个' : '仅选择当前已加载的 Key'}>
        <input type="checkbox" aria-label="选择全部已加载 Key" checked={allChecked} disabled={props.disabled || !loaded.length || loaded.length > 100} onChange={event => setChecked(new Set(event.target.checked ? loaded : []))} />
        <span>{selected.length ? `已选 ${selected.length}` : '选择已加载'}</span>
      </label>
      <button type="button" disabled={props.disabled || !selected.length} onClick={() => setFrozen([...selected])}><Stack size={13} />批量操作</button>
    </div>
    {props.keys.map(key => <div key={key.key.rawBase64} className={styles.keyRow} data-active={props.selected === key.key.rawBase64}>
      <input type="checkbox" aria-label={`选择 Key ${key.key.display || '（空 Key）'}`} checked={checked.has(key.key.rawBase64)} disabled={props.disabled || (selected.length >= 100 && !checked.has(key.key.rawBase64))} onChange={event => toggle(key.key.rawBase64, event.target.checked)} />
      <button type="button" aria-pressed={props.selected === key.key.rawBase64} disabled={props.disabled} onClick={() => props.onSelect(key.key.rawBase64)}>
        <div><Key size={13} /><span title={key.key.display}>{key.key.display || '（空 Key）'}</span></div>
        <small><span>{key.type}</span><span>{redisTtl(key.ttl)}</span></small>
      </button>
    </div>)}
    {frozen && <RedisBulkDialog base={props.base} database={props.database} keys={frozen} readOnly={props.readOnly} onClose={() => setFrozen(null)} onUnlock={props.onUnlock} onBusyChange={props.onBusyChange} onApplied={applied} />}
  </>
}
