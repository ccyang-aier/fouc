import { CheckSquare } from '@phosphor-icons/react';
import { setBlockFormat } from '../../extensions/format/block-format';
import type { EditorBlockModule } from '../types';
import { TaskListInputRule } from './input-rule';
import { TaskItemToggle } from './task-item-toggle';
import './task-list.css';

export const TaskListModule: EditorBlockModule = {
  name: 'taskList',
  icon: CheckSquare,
  extensions: [TaskListInputRule, TaskItemToggle],
  title: '任务列表',
  shortcut: '⌃ ⇧ 7',
  insert: (editor) => editor.chain().command(setBlockFormat({ kind: 'taskList' })).run(),
};
