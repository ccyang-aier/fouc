import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  openSqlFiles: ['打开 SQL 文件', 'Open SQL files'],
  openAtMostSqlFilesAtATime: [
    '每次最多打开 20 个 SQL 文件。',
    'Open at most 20 SQL files at a time.',
  ],
  sqlFilesInOneBatchMustTotalNoMoreThan: [
    '本批 SQL 文件合计最多 64 MiB，请分批打开。',
    'SQL files in one batch must total no more than 64 MiB. Open them in smaller batches.',
  ],
  importSqlFiles: ['导入 SQL 文件', 'Import SQL files'],
  openLocalSqlFilesLoadIntoQueryTabsOnly: [
    '打开本机 SQL 文件 · 仅加载到查询标签',
    'Open local SQL files · load into query tabs only',
  ],
  downloadSqlFile: ['下载 SQL 文件', 'Download SQL file'],
  downloadTheFullCurrentDocumentAsUtfSql: [
    '下载当前完整文档为 UTF-8 SQL',
    'Download the full current document as UTF-8 SQL',
  ],
  fullSqlDocumentDownloadedAsUtf: [
    '已下载完整 SQL 文档（UTF-8）。',
    'Full SQL document downloaded as UTF-8.',
  ],
  openScriptsInTheCurrentConnection: [
    '在当前连接中打开脚本',
    'Open scripts in the current connection',
  ],
  eachFileOpensInASeparateQueryTabChooseThe: [
    '每个文件建立独立查询标签，打开后由你选择执行范围。',
    'Each file opens in a separate query tab. Choose the execution scope after opening.',
  ],
  fileEncoding: ['文件编码', 'File encoding'],
  sqlFileEncoding: ['SQL 文件编码', 'SQL file encoding'],
  detectBomUtfAutomatically: ['自动识别 BOM / UTF-8', 'Detect BOM / UTF-8 automatically'],
  filesUpToMibEach: ['个文件 · 每个最多 64 MiB', 'files · up to 64 MiB each'],
  sqlFilesToOpen: ['待打开 SQL 文件', 'SQL files to open'],
  readingAndValidatingOriginalFiles: [
    '正在读取和校验原始文件…',
    'Reading and validating original files…',
  ],
  originalContentPreview: ['原始内容预览', 'Original content preview'],
  firstCharacters: ['前 16,000 字符', 'First 16,000 characters'],
  fullFile: ['完整文件', 'Full file'],
  sqlFileContentPreview: ['SQL 文件内容预览', 'SQL file content preview'],
  thePreviewIsTruncatedTheFullOriginalFileIsKept: [
    '预览已截取；打开后仍保留完整原始文件。',
    'The preview is truncated. The full original file is kept when opened.',
  ],
  originalSqlContentIsPreservedWithoutFormattingOrReplacement: [
    '原始 SQL 内容保留，不进行格式化或替换。',
    'Original SQL content is preserved without formatting or replacement.',
  ],
  eachExecutionSupportsUpToMibSelectPartOfA: [
    '单次执行最多 1 MiB，较大的脚本可以选择部分语句执行。',
    'Each execution supports up to 1 MiB. Select part of a larger script to execute.',
  ],
  currentConnection: ['当前连接 ·', 'Current connection · '],
  cancel: ['取消', 'Cancel'],
  open: ['打开', 'Open'],
  queryTabs: ['个查询标签', 'query tabs'],
});
