import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '批量 Key 与过期时间': ['批量 Key 与过期时间', 'Bulk Keys and expiry'],
  关闭批量操作: ['关闭批量操作', 'Close bulk operation'],
  '· 已冻结选择': ['· 已冻结选择', '· Selection frozen'],
  '个 Key': ['个 Key', 'Keys'],
  '来自当前已加载列表；不扩展匹配规则或继续扫描的范围。': [
    '来自当前已加载列表；不扩展匹配规则或继续扫描的范围。',
    'From the currently loaded list; does not expand the pattern or continue scanning.',
  ],
  操作: ['操作', 'Actions'],
  批量操作类型: ['批量操作类型', 'Bulk operation type'],
  '有效期 · 秒': ['有效期 · 秒', 'Lifetime · Seconds'],
  '批量 TTL 秒数': ['批量 TTL 秒数', 'Bulk TTL seconds'],
  '从 Redis 实际执行时开始计时。': [
    '从 Redis 实际执行时开始计时。',
    'Timing begins when Redis actually executes the operation.',
  ],
  本地绝对过期时间: ['本地绝对过期时间', 'Local absolute expiry'],
  批量绝对过期时间: ['批量绝对过期时间', 'Bulk absolute expiry'],
  '使用当前浏览器时区；过去的期限会立即删除。': [
    '使用当前浏览器时区；过去的期限会立即删除。',
    'Uses the current browser time zone; a past deadline deletes immediately.',
  ],
  '先生成只读预览，核对实际类型、原始快照与绝对期限。永久保留请明确选择 PERSIST；删除需要额外输入 DELETE。':
    [
      '先生成只读预览，核对实际类型、原始快照与绝对期限。永久保留请明确选择 PERSIST；删除需要额外输入 DELETE。',
      'Generate a read-only preview first. Verify the actual type, original snapshot and absolute deadline. Choose PERSIST explicitly to retain a key; deletion also requires entering DELETE.',
    ],
  当前会话保持只读: ['当前会话保持只读', 'Current session remains read-only'],
  '解锁会使旧计划失效；随后需重新预览并确认。': [
    '解锁会使旧计划失效；随后需重新预览并确认。',
    'Unlocking invalidates old plans. Preview and confirm again afterward.',
  ],
  解锁本次会话: ['解锁本次会话', 'Unlock this session'],
  我已核对: ['我已核对', 'I have verified'],
  '个 Key，确认提交此一次性计划；脚本运行时错误不会自动回滚。': [
    '个 Key，确认提交此一次性计划；脚本运行时错误不会自动回滚。',
    'Keys. Confirm this single-use plan; script errors do not roll back automatically.',
  ],
  '输入 DELETE 确认不可撤销删除': [
    '输入 DELETE 确认不可撤销删除',
    'Enter DELETE to confirm irreversible deletion',
  ],
  '输入 DELETE 确认批量删除': ['输入 DELETE 确认批量删除', 'Enter DELETE to confirm bulk deletion'],
  '单个 Lua 批次已发送，等待 Redis 实际确认；此时取消无法撤回已发送的命令。': [
    '单个 Lua 批次已发送，等待 Redis 实际确认；此时取消无法撤回已发送的命令。',
    'A Lua batch has been sent and is awaiting Redis confirmation. Canceling now cannot retract the sent command.',
  ],
  '读取有界原始快照…': ['读取有界原始快照…', 'Reading bounded raw snapshot…'],
  '校验写入能力…': ['校验写入能力…', 'Checking write access…'],
  '最多 100 Key · 单脚本隔离 · 原值与绝对期限保护': [
    '最多 100 Key · 单脚本隔离 · 原值与绝对期限保护',
    'Up to 100 Keys · Single-script isolation · Original value and absolute deadline protection',
  ],
  完成: ['完成', 'Done'],
  取消预览: ['取消预览', 'Cancel preview'],
  取消: ['取消', 'Cancel'],
  重新预览: ['重新预览', 'Preview again'],
  生成只读预览: ['生成只读预览', 'Generate read-only preview'],
  '等待确认…': ['等待确认…', 'Awaiting confirmation…'],
  确认执行一次: ['确认执行一次', 'Execute once'],
  'REDIS / BATCH REVIEW': ['REDIS / 批量操作审核', 'REDIS / BATCH REVIEW'],
});
