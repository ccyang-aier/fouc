import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  completion: ['完成进度 {percent}%', '{percent}% complete'],
  checklist: ['检查清单 {done} / {total}', 'Checklist {done} / {total}'],
  completedStatus: ['任务已标记为完成', 'Task marked as complete'],
  dueToday: ['今天到期，进度不足 70%', 'Due today with less than 70% complete'],
  dueSoon: ['{days} 天后到期，进度不足 70%', 'Due in {days} days with less than 70% complete'],
  overdue: ['已逾期 {days} 天，进度不足 70%', '{days} days overdue with less than 70% complete'],
  assignedFor: ['负责人', 'Assigned for'],
  noDueDate: ['未设置日期', 'No due date'],
  searchStatuses: ['搜索状态…', 'Search statuses…'],
  clearSearch: ['清除搜索', 'Clear search'],
  noStatuses: ['无匹配项', 'No matches'],
});
