import { Archive, ChatCircleDots, ChatsCircle, ListChecks, Planet, PlugsConnected, Robot, SquaresFour, UsersThree } from '@/components/icons';
import type { WorkbenchView } from './workbench-view';

export type WorkbenchPage = Exclude<WorkbenchView, 'settings'>;
export const workbenchPages = {
  home: { label: '新对话', icon: ChatCircleDots },
  workbench: { label: '工作台', icon: SquaresFour },
  tasks: { label: '任务', icon: ListChecks },
  members: { label: '成员', icon: UsersThree },
  assets: { label: '资产', icon: Archive },
  chats: { label: '频道', icon: ChatsCircle },
  agents: { label: '智能体', icon: Robot },
  community: { label: '社区', icon: Planet },
  connectors: { label: '连接器', icon: PlugsConnected },
} as const;
