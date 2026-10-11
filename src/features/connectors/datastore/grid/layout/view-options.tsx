"use client"

import { useId, useRef, useState, type ReactNode } from 'react'
import { ArrowsHorizontal, CheckSquare, Columns, Copy, Hash, MagnifyingGlass, Minus, Palette, Plus, Rows, SlidersHorizontal, TextAa, TextAlignRight, Wrench } from '@phosphor-icons/react'
import type { DatabaseQueryResult } from '@fouc/shared'
import { TableQueryPopover } from '../../table-query-popover'
import { TableQuerySelect } from '../../table-query-select'
import { allNullGridColumns, type GridLayout } from './model'
import styles from './workbench-controls.module.css'

function Segments<Value extends string>({ label, value, choices, onChange }: { label: string; value: Value; choices: readonly { value: Value; label: string }[]; onChange: (value: Value) => void }) {
  return <div className={styles.segments} role="group" aria-label={label}>{choices.map(choice => <button type="button" className="fouc-action" key={choice.value} aria-pressed={choice.value === value} onClick={() => onChange(choice.value)}>{choice.label}</button>)}</div>
}
function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) { return <div className={styles.optionRow}><span>{icon}{label}</span>{children}</div> }
export function GridViewOptions({ result, layout, onChange }: { result: DatabaseQueryResult; layout: GridLayout; onChange: (layout: GridLayout) => void }) {
  const [open, setOpen] = useState(false), [copySettings, setCopySettings] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null), id = useId()
  function update<Key extends keyof GridLayout>(key: Key, value: GridLayout[Key]) { onChange({ ...layout, [key]: value }) }
  return <>
    <button ref={anchor} type="button" className="fouc-action" aria-label="视图选项" title="视图选项" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}><Wrench size={16} /></button>
    <TableQueryPopover id={id} label="视图选项" open={open} anchor={anchor} onClose={() => setOpen(false)} width={336} className={styles.popover}>
      <header className={styles.head}><strong>视图选项</strong></header>
      <div className={styles.options}>
        <Row icon={<Columns size={16} />} label="列宽"><Segments label="列宽" value={layout.density} choices={[{ value: 'compact', label: '紧凑' }, { value: 'standard', label: '标准' }, { value: 'comfortable', label: '宽松' }]} onChange={value => onChange({ ...layout, density: value, widths: {} })} /></Row>
        <Row icon={<ArrowsHorizontal size={16} />} label="列宽布局"><Segments label="列宽布局" value={layout.widthMode} choices={[{ value: 'fill', label: '填满可用宽度' }, { value: 'content', label: '按内容宽度' }]} onChange={value => update('widthMode', value)} /></Row>
        <Row icon={<TextAa size={16} />} label="表格字体"><TableQuerySelect label="表格字体" value={layout.font} disabled={false} options={[{ value: 'sans', label: '界面字体' }, { value: 'mono', label: '等宽字体' }]} onChange={value => update('font', value)} /></Row>
        <Row icon={<TextAa size={16} />} label="表格字号"><div className={styles.stepper}><button type="button" className="fouc-action" aria-label="减小表格字号" disabled={layout.fontSize <= 12} onClick={() => update('fontSize', layout.fontSize - 1)}><Minus size={15} /></button><strong>{layout.fontSize}</strong><button type="button" className="fouc-action" aria-label="增大表格字号" disabled={layout.fontSize >= 16} onClick={() => update('fontSize', layout.fontSize + 1)}><Plus size={15} /></button></div></Row>
        <Row icon={<MagnifyingGlass size={16} />} label="搜索模式"><Segments label="搜索模式" value={layout.searchMode} choices={[{ value: 'filter', label: '过滤' }, { value: 'highlight', label: '高亮' }]} onChange={value => update('searchMode', value)} /></Row>
        <Row icon={<Hash size={16} />} label="行号显示方式"><Segments label="行号显示方式" value={layout.rowNumberMode} choices={[{ value: 'view', label: '视图序号' }, { value: 'source', label: '原始行号' }]} onChange={value => update('rowNumberMode', value)} /></Row>
        <Row icon={<Rows size={16} />} label="多行转置"><Segments label="多行转置" value={layout.transposeMode} choices={[{ value: 'current', label: '当前行' }, { value: 'multiple', label: '多行' }]} onChange={value => update('transposeMode', value)} /></Row>
        <Row icon={<TextAlignRight size={16} />} label="数值列对齐"><Segments label="数值列对齐" value={layout.numericAlign} choices={[{ value: 'left', label: '左对齐' }, { value: 'right', label: '右对齐' }]} onChange={value => update('numericAlign', value)} /></Row>
        <Row icon={<CheckSquare size={16} />} label="布尔值显示"><Segments label="布尔值显示" value={layout.booleanMode} choices={[{ value: 'text', label: '文本' }, { value: 'checkbox', label: '复选框' }]} onChange={value => update('booleanMode', value)} /></Row>
        <Row icon={<Palette size={16} />} label="数据类型着色"><button type="button" className={styles.switch} role="switch" aria-label="数据类型着色" aria-checked={layout.typeColors} onClick={() => update('typeColors', !layout.typeColors)} /></Row>
        <Row icon={<MagnifyingGlass size={16} />} label="隐藏 NULL 列"><button type="button" className={styles.switch} role="switch" aria-label="隐藏 NULL 列" aria-checked={layout.hideNullColumns} disabled={!layout.hideNullColumns && !allNullGridColumns(result).length} onClick={() => update('hideNullColumns', !layout.hideNullColumns)} /></Row>
        <Row icon={<Copy size={16} />} label="默认复制方式"><div className={styles.copyOptions}><TableQuerySelect label="默认复制方式" value={layout.copyMode} disabled={false} options={[{ value: 'smart', label: '智能复制' }, { value: 'tsv', label: 'TSV' }, { value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }]} onChange={value => update('copyMode', value)} /><button type="button" className="fouc-action" aria-label="复制选项" aria-expanded={copySettings} onClick={() => setCopySettings(value => !value)}><SlidersHorizontal size={16} /></button></div></Row>
        {copySettings && <label className={styles.copyHeaders}><input type="checkbox" checked={layout.copyHeaders} disabled={layout.copyMode === 'json'} title={layout.copyMode === 'json' ? 'JSON 格式始终保留字段名' : undefined} onChange={event => update('copyHeaders', event.target.checked)} />复制时包含列名</label>}
      </div>
    </TableQueryPopover>
  </>
}
