import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  invalidConfiguration: ['生成配置无效：{p0}', 'Invalid generation configuration: {p0}'],
  generatedDataExceedsMibReduceRowsOrText: [
    '生成数据超过 5 MiB；请减少行数或文字长度。当前没有写入数据库。',
    'Generated data exceeds 5 MiB. Reduce rows or text length. Nothing has been written to the database.',
  ],
  rowStillCannotSatisfyBatchUniquenessAfterAttempts: [
    '第 {p0} 行在 100 次尝试后仍无法满足本批唯一约束。请扩大范围、使用序列或减少行数；当前没有写入数据库。',
    'Row {p0} still cannot satisfy batch uniqueness after 100 attempts. Widen the range, use a sequence, or reduce rows. Nothing has been written to the database.',
  ],
  localGenerationCancelledNoCommitWasPrepared: [
    '已取消本地生成，没有准备提交。',
    'Local generation cancelled; no commit was prepared.',
  ],
});
