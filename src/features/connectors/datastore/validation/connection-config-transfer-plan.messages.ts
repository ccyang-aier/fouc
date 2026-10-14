import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  tooManyConnectionsHaveTheSameNameEnter: [
    '重名连接过多，请手动填写新的连接名称',
    'Too many connections have the same name. Enter a new connection name manually',
  ],
  importSelectionDoesNotMatchTheValidatedConfiguration: [
    '导入选择与已校验配置数量不一致',
    'Import selection does not match the validated configuration count',
  ],
  itemHasAnInvalidUpdateTargetOrIts: [
    '第 {p0} 项更新目标无效或名称已变化，请重新审查',
    'Item {p0} has an invalid update target or its name changed. Review again',
  ],
  oneExistingConnectionCannotBeUpdatedRepeatedlyIn: [
    '同一现有连接不能在一次导入中被重复更新',
    'One existing connection cannot be updated repeatedly in the same import',
  ],
  itemHasAnInvalidImportName: ['第 {p0} 项导入名称无效', 'Item {p0} has an invalid import name'],
  connectionStillHasANameConflictSkipIt: [
    '连接「{p0}」名称仍有冲突，请选择跳过、改名或明确更新',
    'Connection “{p0}” still has a name conflict. Skip it, rename it, or explicitly update it',
  ],
});
