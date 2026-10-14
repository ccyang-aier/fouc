import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '查询已取消。': ['查询已取消。', 'Query canceled.'],
  只读命令: ['只读命令', 'Read-only command'],
  'Extended JSON 命令文档 · 不执行 JavaScript': [
    'Extended JSON 命令文档 · 不执行 JavaScript',
    'Extended JSON command document · JavaScript is never executed',
  ],
  取消: ['取消', 'Cancel'],
  运行: ['运行', 'Run'],
  'MongoDB 只读命令': ['MongoDB 只读命令', 'MongoDB read-only command'],
  '支持 find、aggregate、count、distinct、统计与 queryPlanner。$out、$merge、$where 和写入命令会被拦截。':
    [
      '支持 find、aggregate、count、distinct、统计与 queryPlanner。$out、$merge、$where 和写入命令会被拦截。',
      'Supports find, aggregate, count, distinct, statistics and queryPlanner. $out, $merge, $where and write commands are blocked.',
    ],
  正在读取: ['正在读取', 'Reading'],
  ' · {v0} 个文档': [' · {v0} 个文档', ' · {v0} documents'],
  ' · 更多结果未展示': [' · 更多结果未展示', ' · More results omitted'],
});
