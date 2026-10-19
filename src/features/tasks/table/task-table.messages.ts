import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  table: ['任务表格', 'Task table'], task: ['任务', 'Task'], description: ['描述', 'Description'],
  assignees: ['负责人', 'Members'], startDate: ['开始日期', 'Start date'], priority: ['优先级', 'Priority'],
  status: ['状态', 'Status'], labels: ['标签', 'Tags'], actions: ['操作', 'Actions'],
  selectTask: ['选择任务：{title}', 'Select task: {title}'], selectGroup: ['选择“{name}”中的所有可见任务', 'Select all visible tasks in {name}'],
  toggleGroup: ['展开或收起：{name}', 'Expand or collapse: {name}'], selected: ['已选择 {count} 项', '{count} selected'],
  clearSelection: ['取消选择', 'Clear selection'], moveSelected: ['移动所选任务', 'Move selected tasks'],
  changeStatus: ['更改状态：{title}', 'Change status: {title}'],
  notScheduled: ['未排期', 'Not scheduled'], noDescription: ['暂无描述', 'No description'], noLabels: ['无标签', 'No tags'],
  empty: ['暂无任务', 'No tasks yet'], filteredEmpty: ['没有符合条件的任务', 'No matching tasks'],
});
