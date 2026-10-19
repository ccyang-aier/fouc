import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  newView: ['新建视图', 'New view'], renameView: ['重命名视图', 'Rename view'], removeView: ['删除视图', 'Delete view'],
  viewName: ['视图名称', 'View name'], viewNamePlaceholder: ['为视图起个名字', 'Name your view'], viewKind: ['视图类型', 'View type'],
  kanban: ['看板', 'Board'], calendar: ['日历', 'Calendar'], spreadsheet: ['表格', 'Table'],
  create: ['创建视图', 'Create view'], save: ['保存', 'Save'], cancel: ['取消', 'Cancel'],
  nameRequired: ['请输入视图名称。', 'Enter a view name.'], saveFailed: ['保存失败，内容已保留。', 'Could not save. Your changes are preserved.'],
  viewActions: ['视图操作：{name}', 'View actions: {name}'], views: ['任务视图', 'Task views'],
  viewLimit: ['最多创建 24 个视图', 'Create up to 24 views'],
  firstView: ['创建第一个视图', 'Create your first view'], empty: ['暂无视图', 'No views yet'],
  emptyReadOnly: ['编辑者创建视图后，即可在这里查看任务。', 'An editor can create a view to display tasks here.'],
  removeDescription: ['删除视图“{name}”。看板中的任务会保留。', 'Delete the view “{name}”. Tasks stay in the board.'],
});
