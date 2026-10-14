import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  addLocalNote: ['添加本地笔记', 'Add local note'],
  editLocalNote: ['编辑本地笔记', 'Edit local note'],
  nativeDatabaseComment: ['数据库原生注释', 'Native database comment'],
  preview: ['预览', 'Preview'],
  bytes: ['/ 65,536 字节', '/ 65,536 bytes'],
  noNoteEnteredYet: ['尚未输入笔记。', 'No note entered yet.'],
  localMarkdownNoteClearToUseTheNativeDatabaseComment: [
    'Markdown 本地笔记 · 清空后恢复使用数据库原生注释',
    'Local Markdown note · Clear to use the native database comment again',
  ],
  savedOnlyToThisDeviceSConnectionAndDatabaseNative: [
    '只保存到当前设备的连接与数据库，不修改数据库原生注释。',
    "Saved only to this device's connection and database; native database comments are unchanged.",
  ],
  cancel: ['取消', 'Cancel'],
  saving: ['保存中…', 'Saving…'],
  saveNote: ['保存笔记', 'Save note'],
  deviceLocalMarkdownNote: ['设备本地 Markdown 笔记', 'Device-local Markdown note'],
  noDescription: ['暂无描述', 'No description'],
  addALocalMarkdownNote: ['，可添加本地 Markdown 笔记。', '; add a local Markdown note.'],
  theCurrentConnectionIsNotSaved: [
    '；当前连接未持久保存。',
    '; the current connection is not saved.',
  ],
});
