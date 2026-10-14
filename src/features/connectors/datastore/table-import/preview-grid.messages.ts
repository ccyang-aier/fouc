import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  missingUseDefault: ['缺失 · 使用默认值', 'Missing · use default'],
  emptyString: ['空字符串', 'Empty string'],
  sourceDataPreview: ['源数据预览', 'Source data preview'],
  showingFirst: ['显示前', 'Showing first'],
  rowsTotal: ['行 / 共', 'rows / total'],
  row: ['行', ' row'],
  sourceSql: ['源 SQL：', 'Source SQL:'],
  dataParsingOnlyWritesToTheTargetTableUsingThe: [
    '· 仅解析数据，按当前映射写入目标表',
    '· Data parsing only; writes to the target table using the current mapping',
  ],
  record: ['记录', 'Record'],
});
