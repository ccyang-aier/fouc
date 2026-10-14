import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  confirmingNativeStructureAndReadScope: [
    '正在确认原生结构与读取范围',
    'Confirming native structure and read scope',
  ],
  readingAndWritingNativeData: ['正在读取并写入原生数据', 'Reading and writing native data'],
  packagingTheManifestAndCompletingFiles: [
    '正在封装清单与完成文件',
    'Packaging the manifest and completing files',
  ],
  nativeDatabaseExportCompleted: ['原生数据库导出已完成', 'Native database export completed'],
  exportCancelledTemporaryFilesRemoved: [
    '导出已取消，临时文件已清理',
    'Export cancelled; temporary files removed',
  ],
  exportIncompleteDownloadIsUnavailable: [
    '导出未完成，文件未开放下载',
    'Export incomplete; download is unavailable',
  ],
  readOnlySourceConnectionStreamingToTheLocalDevice: [
    '只读源连接 · 设备本地流式写入',
    'Read-only source connection · Streaming to the local device',
  ],
  sourceDataWasNotModified: ['源数据未被修改', 'Source data was not modified'],
  completedExportObjects: ['完成的导出对象', 'Completed export objects'],
  rowsActuallyExported: ['实际导出行', 'Rows actually exported'],
  writtenToDevice: ['已写入设备', 'Written to device'],
  completedObjects: ['已完成对象', 'Completed objects'],
  objectProgressIsNotAPercentageOfFullTableRows: [
    '对象进度不代表全表行数百分比；原生目录不预先扫描 COUNT(*)，实际行数以已读取数据为准。',
    'Object progress is not a percentage of full-table rows. The native catalog does not run COUNT(*) first; actual counts come from data read.',
  ],
  actualExportScope: ['实际导出范围', 'Actual export scope'],
  allVisibleRowsPerTable: ['每表全部可见行', 'All visible rows per table'],
  upToRowsPerTable: ['每表最多 {p0} 行', 'Up to {p0} rows per table'],
  uniqueKeyCursor: ['唯一键游标', 'Unique-key cursor'],
  row: ['行', ' row'],
  moreRowsRemainExplicitLimit: ['仍有更多行 · 显式限量', 'More rows remain · Explicit limit'],
  readToTheEndOfTheRange: ['已读至范围末尾', 'Read to the end of the range'],
  nativeConsistencyAndFormatInformation: [
    '原生一致性与格式说明 ·',
    'Native consistency and format information · ',
  ],
});
