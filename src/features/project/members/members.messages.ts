import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  title: ['团队', 'Teams'], members: ['成员', 'Members'], overview: ['团队概览', 'Team Overview'], departments: ['部门看板', 'Department Board'],
  add: ['新增成员', 'New Member'], newDepartment: ['新建部门', 'New Department'], new: ['新建…', 'New…'],
  search: ['搜索', 'Search'], clearSearch: ['清除搜索', 'Clear search'], filter: ['筛选', 'Filter'], allStatuses: ['全部状态', 'All statuses'],
  name: ['姓名', 'Name'], position: ['职位', 'Position'], department: ['部门', 'Department'], joined: ['加入时间', 'Joining'], email: ['邮箱', 'Email'], phone: ['电话', 'Phone'], status: ['状态', 'Status'],
  grid: ['成员卡片', 'Member cards'], list: ['成员列表', 'Member list'], open: ['查看 {name}', 'View {name}'], details: ['成员详情', 'Member details'],
  close: ['关闭', 'Close'], cancel: ['取消', 'Cancel'], save: ['保存更改', 'Save changes'], create: ['创建', 'Create'],
  remove: ['移除成员', 'Remove member'], removeTitle: ['移除这位示例成员？', 'Remove this preview member?'], removeDescription: ['此操作将从当前示例目录中移除 {name}。', 'This will remove {name} from this preview directory.'],
  added: ['已添加到示例目录', 'Added to the preview directory'], saved: ['示例资料已更新', 'Preview profile updated'], removed: ['已从示例目录移除', 'Removed from the preview directory'],
  noMatches: ['没有匹配的成员', 'No matching members'], clearFilters: ['清除筛选', 'Clear filters'], empty: ['暂无成员', 'No members yet'],
  departmentName: ['部门名称', 'Department name'], duplicateDepartment: ['此部门已存在', 'This department already exists'], departmentCreated: ['部门已创建', 'Department created'],
  count: ['{count} 位成员', '{count} members'], newMemberIn: ['添加 {department} 成员', 'Add member to {department}'],
  Remote: ['远程', 'Remote'], Active: ['在职', 'Active'], 'Part-time': ['兼职', 'Part-time'],
});
