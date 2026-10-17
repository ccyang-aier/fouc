import { Archive, BookOpenText, ChatCircleDots, ChatsCircle, ListChecks, Planet, PlugsConnected, Robot, SquaresFour, UsersThree } from '@phosphor-icons/react';
import type { WorkbenchView } from './workbench-view';

export type WorkbenchPage = Exclude<WorkbenchView, 'settings'>;
export const workbenchPages = {
  home: { label: '新对话', icon: ChatCircleDots },
  workbench: { label: '工作台', icon: SquaresFour },
  tasks: { label: '任务', icon: ListChecks },
  members: { label: '成员', icon: UsersThree },
  assets: { label: '资产', icon: Archive },
  chats: { label: '聊天', icon: ChatsCircle },
  agents: { label: '智能体', icon: Robot },
  community: { label: '社区', icon: Planet },
  connectors: { label: '连接器', icon: PlugsConnected },
  knowledge: { label: '知识库', icon: BookOpenText },
} as const;
