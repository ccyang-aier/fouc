import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  addLabel: ['添加标签', 'Add label'],
  removeLabel: ['移除标签“{name}”', 'Remove label “{name}”'],
  searchOrCreate: ['搜索或新建标签…', 'Search or create a label…'],
  labelName: ['标签名称', 'Label name'],
  color: ['标签颜色', 'Label color'],
  nameRequired: ['请输入标签名称。', 'Enter a label name.'],
  nameTooLong: ['标签名称最多 40 个字符。', 'Use 40 characters or fewer.'],
  alreadyAdded: ['此任务已添加该标签。', 'This task already has this label.'],
  labelLimit: ['每个任务最多添加 20 个标签。', 'Add up to 20 labels per task.'],
  blue: ['蓝色', 'Blue'], violet: ['紫色', 'Violet'], rose: ['玫瑰色', 'Rose'], orange: ['橙色', 'Orange'],
  amber: ['琥珀色', 'Amber'], green: ['绿色', 'Green'], teal: ['青绿色', 'Teal'], cyan: ['青蓝色', 'Cyan'],
});
