import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  'Redis 批量只读预览': ['Redis 批量只读预览', 'Redis bulk read-only preview'],
  明确选择: ['明确选择', 'Explicit selection'],
  '个 Key': ['个 Key', 'Keys'],
  当前存在: ['当前存在', 'Currently exists'],
  个: ['个', ' items'],
  将执行: ['将执行', 'Will execute'],
  'Key / 类型': ['Key / 类型', 'Key / Type'],
  当前绝对期限: ['当前绝对期限', 'Current absolute deadline'],
  原始快照: ['原始快照', 'Original snapshot'],
  '（空 Key）': ['（空 Key）', '(empty Key)'],
  ' · 二进制 Key': [' · 二进制 Key', ' · Binary Key'],
  '此操作将删除当前存在的 Key，无法撤销。绝对期限已经过去时同样会立即删除。': [
    '此操作将删除当前存在的 Key，无法撤销。绝对期限已经过去时同样会立即删除。',
    'This operation deletes the existing Key and cannot be undone. A deadline in the past also deletes immediately.',
  ],
  '提交将重新核对所有原始 DUMP、类型和绝对期限。外部修改或自然过期会阻止整个批次写入。': [
    '提交将重新核对所有原始 DUMP、类型和绝对期限。外部修改或自然过期会阻止整个批次写入。',
    'Submission rechecks every original DUMP, type and absolute deadline. External changes or natural expiry prevent the entire batch from writing.',
  ],
  原子边界与预览限制: ['原子边界与预览限制', 'Atomic boundaries and preview limits'],
  预览有效至: ['预览有效至', 'Preview valid until'],
  '；解锁或重新锁定、切换数据库、断开连接均使旧计划失效。': [
    '；解锁或重新锁定、切换数据库、断开连接均使旧计划失效。',
    '; unlocking, relocking, changing the database or disconnecting invalidates old plans.',
  ],
  批次执行已确认: ['批次执行已确认', 'Batch execution confirmed'],
  '检测到冲突 · 整批零写入': [
    '检测到冲突 · 整批零写入',
    'Conflict detected · No writes in the batch',
  ],
  '结果未确认 · 请刷新核对': ['结果未确认 · 请刷新核对', 'Result unconfirmed · Refresh to verify'],
  '提交被拒绝 · 未开始写入': ['提交被拒绝 · 未开始写入', 'Submission rejected · No writes started'],
  '批次已停止 · 核对逐项结果': ['批次已停止 · 核对逐项结果', 'Batch stopped · Verify each result'],
  'Redis 批量操作结果': ['Redis 批量操作结果', 'Redis bulk operation results'],
  已执行: ['已执行', 'Executed'],
  '· 无需更改': ['· 无需更改', '· No change needed'],
  '· 原本缺失': ['· 原本缺失', '· Originally missing'],
  '· 未确认': ['· 未确认', '· Unconfirmed'],
  实际结果: ['实际结果', 'Actual results'],
  '期限 / 原因': ['期限 / 原因', 'Deadline / Reason'],
  '列表已请求刷新；已确认的写入不会回滚，未确认结果不会自动重试。需要继续时请重新选择并生成新的只读预览。':
    [
      '列表已请求刷新；已确认的写入不会回滚，未确认结果不会自动重试。需要继续时请重新选择并生成新的只读预览。',
      'List refresh requested. Confirmed writes will not roll back and unconfirmed results will not retry automatically. Select again and generate a new read-only preview to continue.',
    ],
});
