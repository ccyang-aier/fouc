import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  emptyCurrentDataTable: ['清空当前数据表', 'Empty current data table'],
  emptyTable: ['清空表', 'Empty table'],
  unlockedAndReviewedAgainInReadOnlyModeEnterThe: [
    '已解锁并重新只读审查；请输入完整表名后明确确认。',
    'Unlocked and reviewed again in read-only mode. Enter the full table name and explicitly confirm.',
  ],
  fullControlledSqlCopied: ['完整受控 SQL 已复制。', 'Full controlled SQL copied.'],
  fullControlledSqlCopiedNotExecuted: [
    '完整受控 SQL 已复制；尚未执行。',
    'Full controlled SQL copied; not executed.',
  ],
  copyFailedSelectAndCopyTheSqlManually: [
    '复制失败，请从 SQL 区域手动选择并复制。',
    'Copy failed. Select and copy the SQL manually.',
  ],
  emptyDataTable: ['清空数据表', 'Empty data table'],
  targetNativeTable: ['目标原生表', 'Target native table'],
  allDataStructurePreserved: ['· 所有数据 · 结构保留', '· All data · structure preserved'],
  readingActualStructureReferencesPermissionsAndCurrentlyVisibleRowCount: [
    '读取真实结构、引用、权限与当前可见行数…',
    'Reading actual structure, references, permissions, and currently visible row count…',
  ],
  readOnlyReviewNoDataHasBeenEmptied: [
    '只读审查，尚未清空任何数据。',
    'Read-only review; no data has been emptied.',
  ],
  iExplicitlyAcceptResettingMysqlAutoIncrement: [
    '我明确接受 MySQL AUTO_INCREMENT 重置',
    'I explicitly accept resetting MySQL AUTO_INCREMENT',
  ],
  changingThisChoiceRequiresANewReviewResetIsBlocked: [
    '选择变化后必须重新审查；默认阻止重置。',
    'Changing this choice requires a new review. Reset is blocked by default.',
  ],
  iHaveReviewedNativeTriggersAndTheirImpactOnOther: [
    '我已审查原生触发器及其对其他表的影响',
    'I have reviewed native triggers and their impact on other tables',
  ],
  triggerCodeComesFromTheCurrentDatabaseCatalogAndMay: [
    '触发器代码来自当前数据库目录，不保证无额外副作用。',
    'Trigger code comes from the current database catalog and may have additional side effects.',
  ],
  riskChoicesChangedReadAndReviewAgain: [
    '风险选择已变化，请重新读取并审查。',
    'Risk choices changed. Read and review again.',
  ],
  theSessionCurrentlyLocksWritesUnlockingRevokesTheOldPlan: [
    '会话当前锁定写入。解锁后会撤销旧计划并重新审查。',
    'The session currently locks writes. Unlocking revokes the old plan and starts a new review.',
  ],
  unlockingAndReviewingAgain: ['解锁并重新审查…', 'Unlocking and reviewing again…'],
  unlockTableEmptying: ['解锁表清空', 'Unlock table emptying'],
  dangerousActionConfirmationEnterTheFullSchemaTableName: [
    '危险确认：输入完整 Schema.表名',
    'Dangerous action confirmation: enter the full schema.table name',
  ],
  fullTableNameForDangerousEmptyTableConfirmation: [
    '清空危险确认完整表名',
    'Full table name for dangerous empty-table confirmation',
  ],
  confirmationRemovesAllDataInTheTableThisActionIs: [
    '确认会移除整表数据。此操作与当前结果中的筛选和选择无关。',
    'Confirmation removes all data in the table. This action is unrelated to filters or selections in the current results.',
  ],
  waitingForFinalConfirmationFromTheNativeServer: [
    '正在等待原生服务器最终确认；',
    'Waiting for final confirmation from the native server;',
  ],
  aCommittedTruncateCannotBeUndone: [
    '已提交的 TRUNCATE 不能撤销。',
    'A committed TRUNCATE cannot be undone.',
  ],
  interruptionsBeforeCommitAreHandledByTheTransactionANetwork: [
    '提交前中断由事务处理，不能把网络断开当作已回滚。',
    'Interruptions before commit are handled by the transaction. A network disconnect does not prove rollback.',
  ],
  close: ['关闭', 'Close'],
  cancel: ['取消', 'Cancel'],
  planAlreadyConsumed: ['计划已消费', 'Plan already consumed'],
  planExpiresIn: ['计划剩余 {p0}:{p1}', 'Plan expires in {p0}:{p1}'],
  planExpired: ['计划已过期', 'Plan expired'],
  reviewWithoutWrites: ['零写入审查', 'Review without writes'],
  copyEmptyTableSql: ['复制表清空 SQL', 'Copy empty-table SQL'],
  readOnlyReview: ['只读审查中…', 'Read-only review…'],
  readAndReviewAgain: ['重新读取并审查', 'Read and review again'],
  waitingForNativeConfirmation: ['等待原生确认…', 'Waiting for native confirmation…'],
  confirmEmptyingTheEntireTable: ['确认清空整表', 'Confirm emptying the entire table'],
});
