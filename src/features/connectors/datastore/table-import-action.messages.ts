import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  importTableData: ['导入表数据', 'Import table data'],
  unlockWritesAndFinishStagedChangesFirst: [
    '先解锁写入并完成暂存变更',
    'Unlock writes and finish staged changes first',
  ],
  appendImportsFromCsvTsvJsonNdjsonAndLiteralInsert: [
    'CSV、TSV、JSON / NDJSON 与字面量 INSERT SQL 追加导入',
    'Append imports from CSV, TSV, JSON / NDJSON, and literal INSERT SQL',
  ],
  importData: ['导入数据', 'Import data'],
});
