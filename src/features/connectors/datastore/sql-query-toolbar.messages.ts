import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  sqlQueryToolbar: ['SQL 查询工具栏', 'SQL query toolbar'],
  cancelQuery: ['取消查询', 'Cancel query'],
  run: ['运行', 'Run'],
  interruptDatabaseQuery: ['中断数据库查询', 'Interrupt database query'],
  runSqlCtrlEnterSelectionFirst: [
    '运行 SQL · Ctrl / ⌘ + Enter · 选区优先',
    'Run SQL · Ctrl / ⌘ + Enter · selection first',
  ],
  runAndKeepPreviousResults: ['运行并保留旧结果', 'Run and keep previous results'],
  runAllStatements: ['运行全部语句', 'Run all statements'],
  runAllStatementsCtrlShiftEnter: [
    '运行全部语句 · Ctrl / ⌘ + Shift + Enter',
    'Run all statements · Ctrl / ⌘ + Shift + Enter',
  ],
});
