import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '设置相对 TTL': ['设置相对 TTL', 'Set relative TTL'],
  设置绝对期限: ['设置绝对期限', 'Set absolute deadline'],
  '永久保留 · PERSIST': ['永久保留 · PERSIST', 'Keep forever · PERSIST'],
  '删除 Key · DEL': ['删除 Key · DEL', 'Delete Key · DEL'],
  已执行: ['已执行', 'Executed'],
  无需更改: ['无需更改', 'No change needed'],
  原本缺失: ['原本缺失', 'Originally missing'],
  冲突: ['冲突', 'Conflicts'],
  执行失败: ['执行失败', 'Execution failed'],
  未执行: ['未执行', 'Not executed'],
  结果未确认: ['结果未确认', 'Result unconfirmed'],
  请选择有效的本地绝对过期时间: [
    '请选择有效的本地绝对过期时间',
    'Choose a valid local absolute expiry',
  ],
  'TTL 请输入正整数秒；永久保留请明确选择 PERSIST': [
    'TTL 请输入正整数秒；永久保留请明确选择 PERSIST',
    'Enter positive TTL seconds; choose PERSIST explicitly to keep the key.',
  ],
  'TTL 超出精确时间范围': ['TTL 超出精确时间范围', 'TTL exceeds the exact time range'],
  永久: ['永久', 'Persistent'],
  不存在: ['不存在', 'Does not exist'],
  未确认: ['未确认', 'Unconfirmed'],
});
