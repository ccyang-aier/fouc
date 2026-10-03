import type { TableImportEncoding, TableImportFormat, TableImportParseOptions } from '@fouc/shared/table-import';
import styles from './table-import.module.css';

const FORMATS: Array<[TableImportFormat, string]> = [['csv', 'CSV'], ['tsv', 'TSV'], ['delimited', '自定义分隔文本'], ['json', 'JSON 数组'], ['ndjson', 'NDJSON']];
export function defaultTableImportOptions(format: TableImportFormat): TableImportParseOptions { return { format, titleRow: ['json', 'ndjson'].includes(format) ? 0 : 1, dataStartRow: ['json', 'ndjson'].includes(format) ? 1 : 2, lastDataRow: 0, trimValues: false, emptyStringAsNull: false, nullToken: '\\N', jsonShape: 'auto', delimiter: ',' }; }
export function TableImportParseControls({ options, onChange, encoding, onEncoding, hasFile }: { options: TableImportParseOptions; onChange: (value: TableImportParseOptions) => void; encoding: TableImportEncoding; onEncoding: (value: TableImportEncoding) => void; hasFile: boolean }) {
  const delimited = !['json', 'ndjson'].includes(options.format);
  return <div className={styles.options} aria-label="导入解析设置">
    <div className={styles.optionGrid}>
      <label>源格式<select value={options.format} onChange={(event) => onChange(defaultTableImportOptions(event.target.value as TableImportFormat))}>{FORMATS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {hasFile && <label>文本编码<select value={encoding} onChange={(event) => onEncoding(event.target.value as TableImportEncoding)}><option value="auto">自动检测</option><option value="utf8">UTF-8</option><option value="gbk">GBK / GB18030</option><option value="utf16Le">UTF-16 LE</option><option value="utf16Be">UTF-16 BE</option></select></label>}
      {options.format === 'delimited' && <label>分隔符<input value={options.delimiter ?? ','} maxLength={2} onChange={(event) => onChange({ ...options, delimiter: event.target.value })} placeholder="单个字符，或 \t" /></label>}
      {delimited && <label>标题记录<input type="number" min={0} value={options.titleRow ?? 1} onChange={(event) => onChange({ ...options, titleRow: Number(event.target.value) })} /><small>0 表示没有标题</small></label>}
      <label>数据起始记录<input type="number" min={1} value={options.dataStartRow ?? 1} onChange={(event) => onChange({ ...options, dataStartRow: Number(event.target.value) })} /></label>
      <label>数据结束记录<input type="number" min={0} value={options.lastDataRow ?? 0} onChange={(event) => onChange({ ...options, lastDataRow: Number(event.target.value) })} /><small>0 表示到文件末尾</small></label>
      {!delimited && <label>JSON 行结构<select value={options.jsonShape ?? 'auto'} onChange={(event) => onChange({ ...options, jsonShape: event.target.value as TableImportParseOptions['jsonShape'] })}><option value="auto">自动识别</option><option value="objects">对象行</option><option value="arrays">数组行</option></select></label>}
      {delimited && <label>NULL 标记<input value={options.nullToken ?? ''} onChange={(event) => onChange({ ...options, nullToken: event.target.value || undefined })} placeholder="未设置" /></label>}
    </div>
    {delimited && <div className={styles.checks}><label><input type="checkbox" checked={!!options.trimValues} onChange={(event) => onChange({ ...options, trimValues: event.target.checked })} />去除字段两端空白</label><label><input type="checkbox" checked={!!options.emptyStringAsNull} onChange={(event) => onChange({ ...options, emptyStringAsNull: event.target.checked })} />将空字符串转为 NULL</label></div>}
    <p className={styles.hint}>记录编号按数据记录计算，带引号字段内的换行不拆分记录。数字原文保留，类型提示不会改动目标字段。</p>
  </div>;
}
