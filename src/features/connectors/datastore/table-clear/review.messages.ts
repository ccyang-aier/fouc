import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  rowsVisibleAtReviewTime: ['当时可见行数', 'Rows visible at review time'],
  countUnderCurrentRole: ['· 当前角色 COUNT', '· COUNT under current role'],
  nativeOperation: ['原生操作', 'Native operation'],
  singleTransactionExecution: ['单事务执行', 'Single-transaction execution'],
  implicitCommitCannotBeRolledBack: [
    '隐式提交 · 无法回滚',
    'Implicit commit · cannot be rolled back',
  ],
  preserve: ['保留', 'Preserve'],
  reset: ['重置', 'Reset'],
  notApplicable: ['不适用', 'Not applicable'],
  basedOnCurrentNativeColumns: ['依据当前原生字段', 'Based on current native columns'],
  fullControlledSql: ['完整受控 SQL', 'Full controlled SQL'],
  currentTargetOnlyNoCascade: ['仅当前目标 · 无 CASCADE', 'Current target only · no CASCADE'],
  fullEmptyTableSql: ['完整表清空 SQL', 'Full empty-table SQL'],
  permissionsRead: ['权限已读取', 'Permissions read'],
  insufficientPermissions: ['权限不足', 'Insufficient permissions'],
  nativeValidationAtExecution: ['执行时原生验证', 'Native validation at execution'],
  referencesAndTriggers: ['引用与触发器', 'References and triggers'],
  references: ['条引用 ·', 'references ·'],
  executionTriggers: ['个执行触发器', 'execution triggers'],
  noForeignKeysReferenceTheTargetTableWithinTheCurrent: [
    '当前读取范围内没有引用目标表的外键。',
    'No foreign keys reference the target table within the current read scope.',
  ],
  impactReview: ['影响审查', 'Impact review'],
  theCurrentPlanCannotExecute: ['当前计划不能执行', 'The current plan cannot execute'],
});
