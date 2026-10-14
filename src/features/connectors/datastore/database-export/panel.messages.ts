import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  nativeDatabaseExport: ['原生数据库导出', 'Native database export'],
  selectAtLeastOneTableOrViewInSpecificObject: [
    '指定对象模式下至少选择一张表 / 视图。',
    'Select at least one table or view in specific-object mode.',
  ],
  theCompleteFileWasSavedToTheSelectedLocation: [
    '文件已完整保存至所选位置。',
    'The complete file was saved to the selected location.',
  ],
  theCompleteFileWasHandedToTheBrowserForDownload: [
    '文件已完整交给浏览器下载。',
    'The complete file was handed to the browser for download.',
  ],
  fileDownloadCancelledSaveItAgainWhenReady: [
    '已取消文件下载，可重新保存。',
    'File download cancelled. Save it again when ready.',
  ],
  nativeDatabaseStreamingExport: ['原生数据库流式导出', 'Native database streaming export'],
  databaseExport: ['数据库导出', 'Database export'],
  readOnlySource: ['只读源', 'Read-only source'],
  currentSessionJobs: ['当前会话任务', 'Current session jobs'],
  restoreDatabaseExportJob: ['恢复数据库导出任务', 'Restore database export job'],
  newExportJob: ['新建导出任务', 'New export job'],
  preparing: ['准备', 'Preparing'],
  preparing691: ['准备中', 'Preparing'],
  running: ['运行中', 'Running'],
  packaging: ['封装中', 'Packaging'],
  readyToDownload: ['可下载', 'Ready to download'],
  cancelled: ['已取消', 'Cancelled'],
  failed: ['失败', 'Failed'],
  row: ['行', ' row'],
  deleteDeviceFile: ['删除设备文件', 'Delete device file'],
  restoringExportJobsForTheCurrentSession: [
    '正在恢复当前会话的导出任务…',
    'Restoring export jobs for the current session…',
  ],
  couldNotReadTheNativeObjectCatalog: [
    '原生对象目录读取失败：',
    'Could not read the native object catalog: ',
  ],
  retryCatalog: ['重试目录', 'Retry catalog'],
  readingNativeObjectsInTheSelectedSchemas: [
    '正在读取选中 Schema 的原生对象…',
    'Reading native objects in the selected schemas…',
  ],
  saving: ['正在保存 {p0} / {p1}', 'Saving {p0} / {p1}'],
  reopenToResumeTheDownloadDeviceFilesAreCleanedUp: [
    '关闭后仍可恢复下载；源会话关闭时清理设备文件。',
    'Reopen to resume the download. Device files are cleaned up when the source session closes.',
  ],
  theJobContinuesAfterThisPanelClosesCancellingStopsReads: [
    '关闭面板后任务继续；取消会停止读取并清理文件。',
    'The job continues after this panel closes. Cancelling stops reads and removes the files.',
  ],
  temporaryFileBudgetGibPerSessionGibPerDevice: [
    '临时文件预算：本会话 1 GiB / 设备共 2 GiB。',
    'Temporary file budget: 1 GiB per session / 2 GiB per device.',
  ],
  close: ['关闭', 'Close'],
  cancelDownload: ['取消下载', 'Cancel download'],
  cancelling: ['正在取消…', 'Cancelling…'],
  cancelExport: ['取消导出', 'Cancel export'],
  adjustSettingsAndRetry: ['调整设置并重试', 'Adjust settings and retry'],
  newExport: ['新建导出', 'New export'],
  saveFile: ['保存文件', 'Save file'],
  preparing924: ['正在准备…', 'Preparing…'],
  startNativeExport: ['开始原生导出', 'Start native export'],
});
