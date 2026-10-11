"use client"

import { ArrowCounterClockwise, CaretDown, FloppyDisk, GearSix, Table } from '@phosphor-icons/react'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { ChartField, QueryChartConfig, QueryChartType } from './model'
import styles from './query-chart.module.css'

const types: { id: QueryChartType; label: string }[] = [{ id: 'bar', label: '柱状图' }, { id: 'line', label: '折线图' }, { id: 'pie', label: '饼图' }]
export function ChartToolbar({ config, fields, onChange, onSettings, onReset, onSave, onPreview, preview, canPreview, canSave, persistent }: {
  config: QueryChartConfig; fields: readonly ChartField[]; onChange: (change: Partial<QueryChartConfig>) => void;
  onSettings: () => void; onReset: () => void; onSave: () => void; onPreview: () => void;
  preview: boolean; canPreview: boolean; canSave: boolean; persistent: boolean;
}) {
  const xLabel = fields.find(field => field.key === config.x)?.label ?? (config.x ? '字段已不存在' : '结果行号')
  const yLabel = config.aggregation === 'count' ? '行数' : config.ys.map(key => fields.find(field => field.key === key)?.label ?? '字段已不存在').join('、') || '选择字段'
  return <header className={styles.toolbar}>
    <span className={styles.caption}>类型</span>
    <div className={styles.types} role="group" aria-label="图表类型">
      {types.map(item => <button type="button" key={item.id} className="fouc-action" data-active={config.type === item.id} aria-pressed={config.type === item.id} onClick={() => onChange({ type: item.id })}>{item.label}</button>)}
      {(config.type === 'area' || config.type === 'scatter') && <button type="button" className="fouc-action" data-active="true" aria-pressed onClick={onSettings}>{config.type === 'area' ? '面积图' : '散点图'}</button>}
    </div>
    <span className={styles.divider} />
    <DropdownMenu><DropdownMenuTrigger className={'fouc-action ' + styles.axis} aria-label="图表 X 轴"><span className={styles.caption}>X</span><span className={styles.fieldName}>{xLabel}</span><CaretDown size={13} /></DropdownMenuTrigger>
      <DropdownMenuContent align="start" density="compact"><DropdownMenuRadioGroup value={config.x ?? ''} onValueChange={x => onChange({ x: x || null })}>
        <DropdownMenuRadioItem value="">结果行号</DropdownMenuRadioItem>{fields.map(field => <DropdownMenuRadioItem key={field.key} value={field.key}>{field.label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup></DropdownMenuContent>
    </DropdownMenu>
    <span className={styles.divider} />
    <DropdownMenu><DropdownMenuTrigger className={'fouc-action ' + styles.axis} aria-label="图表 Y 轴" disabled={config.aggregation === 'count'}><span className={styles.caption}>Y</span><span className={styles.fieldName}>{yLabel}</span><CaretDown size={13} /></DropdownMenuTrigger>
      <DropdownMenuContent align="start" density="compact"><DropdownMenuGroup>
        {fields.map(field => <DropdownMenuCheckboxItem key={field.key} checked={config.ys.includes(field.key)} disabled={!field.numeric || (!config.ys.includes(field.key) && config.ys.length >= 6)} onSelect={event => event.preventDefault()} onCheckedChange={checked => onChange({ ys: checked ? [...config.ys, field.key] : config.ys.filter(key => key !== field.key) })}>{field.label}{!field.numeric && <span className={styles.menuHint}>非数值</span>}</DropdownMenuCheckboxItem>)}
        {config.ys.filter(key => !fields.some(field => field.key === key)).map(key => <DropdownMenuCheckboxItem key={key} checked onCheckedChange={() => onChange({ ys: config.ys.filter(value => value !== key) })}>字段已不存在：{key.split('\u0000')[0]}</DropdownMenuCheckboxItem>)}
      </DropdownMenuGroup></DropdownMenuContent>
    </DropdownMenu>
    <span className={styles.divider} />
    <button type="button" className="fouc-action" aria-label="显示数值" aria-pressed={config.showValues} onClick={() => onChange({ showValues: !config.showValues })}>显示数值</button>
    <div className={styles.tools}><DropdownMenu><DropdownMenuTrigger className="fouc-action" aria-label="图表更多设置"><GearSix size={16} /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" density="compact"><DropdownMenuGroup>
        <DropdownMenuItem onSelect={onSettings}><GearSix size={16} />高级设置</DropdownMenuItem>
        <DropdownMenuCheckboxItem checked={preview} disabled={!canPreview} onCheckedChange={onPreview}><Table size={16} />绘图数据</DropdownMenuCheckboxItem>
        <DropdownMenuItem disabled={!persistent || !canSave} onSelect={onSave}><FloppyDisk size={16} />保存图表设置</DropdownMenuItem>
        <DropdownMenuSeparator /><DropdownMenuItem onSelect={onReset}><ArrowCounterClockwise size={16} />恢复默认设置</DropdownMenuItem>
      </DropdownMenuGroup></DropdownMenuContent>
    </DropdownMenu></div>
  </header>
}
