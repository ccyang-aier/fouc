import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  theCommitResultIsUnconfirmedRefreshTheNativeForeignKey: [
    '提交结果未确认，请刷新原生外键目录核对，避免重复提交。{p0}',
    'The commit result is unconfirmed. Refresh the native foreign key catalog to verify before submitting again. {p0}',
  ],
  completeForeignKeyDdlCopied: ['完整外键DDL已复制', 'Complete foreign key DDL copied'],
  clipboardWriteUnavailableCopyManuallyFromTheSqlPreview: [
    '无法写入剪贴板，可在SQL预览中手动复制',
    'Clipboard write unavailable. Copy manually from the SQL preview',
  ],
});
