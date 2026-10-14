import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  chooseABackupFilenameDifferentFromTheRunningDatabaseFile: [
    '请选与运行数据库不同的备份文件名。',
    'Choose a backup filename different from the running database file.',
  ],
  thisBrowserDoesNotSupportStreamingSavesInMemoryDownloads: [
    '当前浏览器不支持流式保存；内存下载最多 {p0} MiB，请减小导出范围或使用支持文件保存的 Chrome / Edge。',
    'This browser does not support streaming saves. In-memory downloads are limited to {p0} MiB; reduce the export scope or use Chrome / Edge with file saving support.',
  ],
  exportFileDownloadFailed: ['导出文件下载失败 ({p0})。', 'Export file download failed ({p0}).'],
  downloadedDataExceedsTheConfirmedFileRange: [
    '下载数据超过已确认文件范围。',
    'Downloaded data exceeds the confirmed file range.',
  ],
  theExportFileWasNotFullyDownloadedTryAgain: [
    '导出文件未完整下载，请重试。',
    'The export file was not fully downloaded. Try again.',
  ],
});
