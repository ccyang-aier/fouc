import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '频道最多 64 KiB，待发布消息最多 1 MiB。': [
    '频道最多 64 KiB，待发布消息最多 1 MiB。',
    'Channels support up to 64 KiB and outgoing messages up to 1 MiB.',
  ],
  发布结果未确认: ['发布结果未确认', 'Publish result unconfirmed'],
  '发布 Pub/Sub 消息': ['发布 Pub/Sub 消息', 'Publish Pub/Sub message'],
  关闭发布消息: ['关闭发布消息', 'Close message publisher'],
  '频道跨 DB 共享。Redis 不保存离线 Pub/Sub 消息，发布返回的接收计数不代表消费者完成处理。': [
    '频道跨 DB 共享。Redis 不保存离线 Pub/Sub 消息，发布返回的接收计数不代表消费者完成处理。',
    'Channels are shared across DBs. Redis does not store offline Pub/Sub messages; the publish receiver count does not confirm consumer processing.',
  ],
  '请先解锁当前 Redis 会话的写入。': [
    '请先解锁当前 Redis 会话的写入。',
    'Unlock writes for this Redis session first.',
  ],
  'Pub/Sub 发布预览': ['Pub/Sub 发布预览', 'Pub/Sub publish preview'],
  '频道 ·': ['频道 ·', 'Channel ·'],
  字节: ['字节', 'bytes'],
  '（空频道）': ['（空频道）', '(empty channel)'],
  '消息 ·': ['消息 ·', 'Messages ·'],
  '（零字节消息）': ['（零字节消息）', '(zero-byte message)'],
  '二进制内容显示为 Base64，提交使用预览时的完整原始字节。': [
    '二进制内容显示为 Base64，提交使用预览时的完整原始字节。',
    'Binary content is displayed as Base64. Submission uses the complete original bytes from preview.',
  ],
  发布频道: ['发布频道', 'Publish channel'],
  发布消息: ['发布消息', 'Publish message'],
  返回编辑: ['返回编辑', 'Back to editing'],
  取消: ['取消', 'Cancel'],
  '发布中…': ['发布中…', 'Publishing…'],
  确认发布: ['确认发布', 'Confirm publish'],
  预览消息: ['预览消息', 'Preview message'],
});
