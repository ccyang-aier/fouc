"use client"

import { useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { ArrowCounterClockwise, ArrowDown, ArrowUp, Code, SlidersHorizontal, WarningCircle } from '@phosphor-icons/react'
import { DEFAULT_SQL_FORMATTER_SETTINGS, parseSqlFormatterConfig, serializeSqlFormatterConfig, type RelationalProvider, type SqlFormatterSettings } from '@fouc/shared'
import { formatSqlText } from './sql-format/formatter'
import { SqlEditor } from './sql-editor'
import styles from './sql-editor-preferences.module.css'

const caseChoices = [['preserve', '保持原样'], ['upper', '大写'], ['lower', '小写']] as const
const INITIAL_PREVIEW = "select u.id, u.name, count(o.id) as order_count from users u left join orders o on o.user_id=u.id where u.active=true and o.created_at >= '2026-01-01' group by u.id,u.name order by order_count desc limit 100;"

type Props = { value: SqlFormatterSettings; provider: RelationalProvider; disabled: boolean; onChange: (value: SqlFormatterSettings) => void; onIssueChange: (value: string) => void }

export function SqlEditorFormatterSettings({ value, provider, disabled, onChange, onIssueChange }: Props) {
  const [source, setSource] = useState(INITIAL_PREVIEW), [preview, setPreview] = useState(''), [previewError, setPreviewError] = useState(''), [pending, setPending] = useState(true)
  const [showSource, setShowSource] = useState(false), [configStatus, setConfigStatus] = useState(''), [configError, setConfigError] = useState('')
  const [paramsText, setParamsText] = useState(() => JSON.stringify(value.paramTypes, null, 2))
  const upload = useRef<HTMLInputElement>(null), previewEditor = useRef<EditorView | null>(null)
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setPending(true)
      void formatSqlText(source, provider, value).then((result) => { if (active) { setPreview(result); setPreviewError('') } }, (reason: unknown) => {
        if (active) setPreviewError(reason instanceof Error ? reason.message : String(reason))
      }).finally(() => { if (active) setPending(false) })
    }, 160)
    return () => { active = false; clearTimeout(timer) }
  }, [source, provider, value])

  function update<K extends keyof SqlFormatterSettings>(key: K, next: SqlFormatterSettings[K]) { onChange({ ...value, [key]: next }); setConfigStatus('') }
  function restore() {
    onChange({ ...DEFAULT_SQL_FORMATTER_SETTINGS }); setParamsText('null'); setConfigError(''); setConfigStatus('已恢复默认，保存后生效'); onIssueChange('')
  }
  async function importConfig(file: File | undefined) {
    if (!file) return
    try {
      if (file.size > 64 * 1024) throw new Error('配置文件不能超过 64 KB。')
      const result = parseSqlFormatterConfig(await file.text())
      if (!result.ok) throw new Error(result.message)
      onChange(result.settings); setParamsText(JSON.stringify(result.settings.paramTypes, null, 2)); setConfigError(''); setConfigStatus('已导入配置，保存后生效'); onIssueChange('')
    } catch (reason) { setConfigError(reason instanceof Error ? reason.message : String(reason)); setConfigStatus('') }
    finally { if (upload.current) upload.current.value = '' }
  }
  function exportConfig() {
    const url = URL.createObjectURL(new Blob([serializeSqlFormatterConfig(value)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'sql-formatter.json'; anchor.click(); URL.revokeObjectURL(url); setConfigStatus('已导出当前格式配置')
  }
  function updateParams(text: string) {
    setParamsText(text)
    const result = parseSqlFormatterConfig(JSON.stringify({ version: 1, formatter: 'sql-formatter', options: { ...value, paramTypes: (() => { try { return JSON.parse(text) as unknown } catch { return text } })() } }))
    if (result.ok) { update('paramTypes', result.settings.paramTypes); setConfigError(''); onIssueChange('') }
    else { const message = '参数语法配置无效，请检查 JSON 和正则表达式。'; setConfigError(message); onIssueChange(message) }
  }

  return <div className={styles.formatLayout}>
    <div className={styles.options}>
      <div className={styles.sectionHeading}><SlidersHorizontal size={16} /><h3>排版规则</h3><button type="button" className={styles.textButton} disabled={disabled} onClick={restore}><ArrowCounterClockwise size={13} />恢复默认</button></div>
      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend>大小写</legend><div className={styles.fieldGrid}>
          {([{ key: 'keywordCase', label: 'SQL 关键字' }, { key: 'dataTypeCase', label: '数据类型' }, { key: 'functionCase', label: '函数名称' }, { key: 'identifierCase', label: '标识符' }] as const).map(({ key, label }) => <label key={key}>{label}<select value={value[key]} aria-label={label + '大小写'} onChange={(event) => update(key, event.target.value as SqlFormatterSettings[typeof key])}>{caseChoices.map(([option, title]) => <option key={option} value={option}>{title}</option>)}</select></label>)}
        </div>{value.identifierCase !== 'preserve' && <p className={styles.warning}><WarningCircle size={13} />标识符大小写可能影响带引号的名称，请核对预览。</p>}
      </fieldset>
      <fieldset className={styles.fieldset} disabled={disabled}><legend>缩进与换行</legend><div className={styles.fieldGrid}>
        <label>排版风格<select aria-label="SQL 排版风格" value={value.indentStyle} onChange={(event) => update('indentStyle', event.target.value as SqlFormatterSettings['indentStyle'])}><option value="standard">DBX 标准排版</option><option value="tabularLeft">表格式 · 左对齐</option><option value="tabularRight">表格式 · 右对齐</option></select></label>
        <label>缩进宽度<select aria-label="SQL 缩进宽度" value={value.tabWidth} onChange={(event) => update('tabWidth', Number(event.target.value) as 2 | 4)}><option value="2">2 个空格</option><option value="4">4 个空格</option></select></label>
        <label>表达式行宽<select aria-label="SQL 表达式行宽" value={value.expressionWidth} onChange={(event) => update('expressionWidth', Number(event.target.value) as 50 | 80 | 120)}>{[50, 80, 120].map((width) => <option key={width} value={width}>{width} 列</option>)}</select></label>
        <label>语句间空行<select aria-label="SQL 语句间空行" value={value.linesBetweenQueries} onChange={(event) => update('linesBetweenQueries', Number(event.target.value) as 0 | 1 | 2)}>{[0, 1, 2].map((lines) => <option key={lines} value={lines}>{lines} 行</option>)}</select></label>
        <label>逻辑运算符<select aria-label="逻辑运算符换行" value={value.logicalOperatorNewline} onChange={(event) => update('logicalOperatorNewline', event.target.value as SqlFormatterSettings['logicalOperatorNewline'])}><option value="before">AND / OR 之前换行</option><option value="after">AND / OR 之后换行</option><option value="none">保持在同一行</option></select></label>
        <label>FROM 布局<select aria-label="FROM 子句布局" value={value.fromClauseLayout} onChange={(event) => update('fromClauseLayout', event.target.value as SqlFormatterSettings['fromClauseLayout'])}><option value="sameLine">与第一个表同一行</option><option value="newLine">表名另起一行</option></select></label>
      </div><div className={styles.toggles}>
        {([{ key: 'useTabs', label: '使用 Tab 缩进' }, { key: 'preserveEmptyLines', label: '保留原始空行' }, { key: 'denseOperators', label: '紧凑运算符' }, { key: 'newlineBeforeSemicolon', label: '分号另起一行' }] as const).map(({ key, label }) => <label key={key} className={styles.check}><input type="checkbox" checked={value[key]} onChange={(event) => update(key, event.target.checked)} />{label}</label>)}
      </div></fieldset>
      <details className={styles.advanced}><summary>参数语法与配置文件</summary><p>默认识别 ?、:name、@name 和模板参数。自定义语法填写 JSON，null 使用默认规则。</p><label>参数语法配置<textarea className={styles.configEditor} aria-label="SQL 格式化参数语法配置" value={paramsText} spellCheck={false} disabled={disabled} onChange={(event) => updateParams(event.target.value)} /></label><div className={styles.configActions}>
        <input ref={upload} hidden type="file" accept="application/json,.json" onChange={(event) => void importConfig(event.target.files?.[0])} />
        <button type="button" className={styles.textButton} disabled={disabled} onClick={() => upload.current?.click()}><ArrowUp size={13} />导入配置</button><button type="button" className={styles.textButton} onClick={exportConfig}><ArrowDown size={13} />导出配置</button>
      </div>{configError && <p className={styles.error} role="alert">{configError}</p>}{configStatus && <p className={styles.help} role="status">{configStatus}</p>}</details>
    </div>
    <section className={styles.previewSection} aria-label="SQL 格式化即时预览"><div className={styles.previewHeading}><Code size={16} /><strong>即时预览</strong><span className={styles.badge}>{provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'}</span></div>
      <div className={styles.previewTabs} role="tablist" aria-label="格式化预览内容"><button type="button" role="tab" aria-selected={!showSource} onClick={() => setShowSource(false)}>格式化结果</button><button type="button" role="tab" aria-selected={showSource} onClick={() => setShowSource(true)}>编辑示例 SQL</button><small role="status">{pending ? '更新中…' : previewError ? '格式无效' : `${preview.split('\n').length} 行`}</small></div>
      <div className={styles.previewCode} aria-busy={pending}>{showSource ? <SqlEditor key="source" value={source} onChange={setSource} onRun={() => {}} provider={provider} editorRef={previewEditor} label="格式化示例 SQL" snippets={[]} /> : previewError ? <p className={styles.previewError} role="alert"><WarningCircle size={16} />{previewError}</p> : <SqlEditor key="result" value={preview} onChange={() => {}} onRun={() => {}} provider={provider} editorRef={previewEditor} readOnly label="SQL 格式化结果预览" />}</div>
      <p className={styles.previewNote}>规则直接应用于当前连接的 SQL 编辑器。预览不会执行 SQL。</p>
    </section>
  </div>
}
