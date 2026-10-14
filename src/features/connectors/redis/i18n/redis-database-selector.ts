import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '请输入有效的非负数据库编号。': [
    '请输入有效的非负数据库编号。',
    'Enter a valid nonnegative database number.',
  ],
  '切换 Redis 数据库': ['切换 Redis 数据库', 'Switch Redis database'],
  关闭数据库选择: ['关闭数据库选择', 'Close database selection'],
  '当前 DB': ['当前 DB', 'Current DB'],
  数据库数量未知: ['数据库数量未知', 'Unknown database count'],
  '{v0} 个数据库': ['{v0} 个数据库', '{v0} databases'],
  刷新数据库目录: ['刷新数据库目录', 'Refresh database directory'],
  '成功切换后重新锁定写入，并清除当前 Key 与分页状态。保存的连接默认 DB 保持原设置。': [
    '成功切换后重新锁定写入，并清除当前 Key 与分页状态。保存的连接默认 DB 保持原设置。',
    "After a successful switch, writes lock again and the current Key and pagination clear. The connection's saved default DB stays unchanged.",
  ],
  '正在读取数据库目录…': ['正在读取数据库目录…', 'Reading database directory…'],
  当前: ['当前', 'Current'],
  'Key 数量未知': ['Key 数量未知', 'Unknown Key count'],
  '{v0} 个 Key': ['{v0} 个 Key', '{v0} Keys'],
  个有期限: ['个有期限', 'with expiry'],
  '当前页没有可列出的数据库；可直接输入编号验证。': [
    '当前页没有可列出的数据库；可直接输入编号验证。',
    'No listed databases on this page. Enter a number to validate directly.',
  ],
  上一页: ['上一页', 'Previous page'],
  从第: ['从第', 'From'],
  项起: ['项起', 'items onward'],
  下一页: ['下一页', 'Next page'],
  数据库编号: ['数据库编号', 'Database number'],
  目标数据库编号: ['目标数据库编号', 'Target database number'],
  '正在连接目标 DB，等待验证结果…': [
    '正在连接目标 DB，等待验证结果…',
    'Connecting to the target DB and awaiting validation…',
  ],
  取消: ['取消', 'Cancel'],
  '连接中…': ['连接中…', 'Connecting…'],
  切换数据库: ['切换数据库', 'Switch database'],
});
