import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '频道或模式名称最多 64 KiB。': [
    '频道或模式名称最多 64 KiB。',
    'Channel or pattern names are limited to 64 KiB.',
  ],
  '已连接 · {v0} 个订阅': ['已连接 · {v0} 个订阅', 'Connected · {v0} subscriptions'],
  '连接与恢复订阅中…': ['连接与恢复订阅中…', 'Connecting and restoring subscriptions…'],
  连接失败: ['连接失败', 'Connection failed'],
  未连接: ['未连接', 'Disconnected'],
  '断开 Pub/Sub': ['断开 Pub/Sub', 'Disconnect Pub/Sub'],
  '连接 Pub/Sub': ['连接 Pub/Sub', 'Connect Pub/Sub'],
  断开: ['断开', 'Disconnect'],
  连接: ['连接', 'Connect'],
  '频道跨 DB 共享；频道和模式同时匹配会保留两条投递。断开期间的消息不会补发，关闭视图会释放订阅连接。':
    [
      '频道跨 DB 共享；频道和模式同时匹配会保留两条投递。断开期间的消息不会补发，关闭视图会释放订阅连接。',
      'Channels are shared across DBs. Matching channel and pattern subscriptions retain two deliveries. Messages during disconnection are not replayed; closing this view releases subscriptions.',
    ],
  '· 已保留消息和上次订阅，可重新连接。': [
    '· 已保留消息和上次订阅，可重新连接。',
    '· Messages and the last subscription retained. Reconnect to continue.',
  ],
  频道订阅: ['频道订阅', 'Channel subscription'],
  模式订阅: ['模式订阅', 'Pattern subscription'],
  订阅频道: ['订阅频道', 'Subscription channel'],
  订阅模式: ['订阅模式', 'Subscription pattern'],
  '处理中…': ['处理中…', 'Working…'],
  订阅: ['订阅', 'Subscribe'],
  '（空名称）': ['（空名称）', '(empty name)'],
  '取消{v0}订阅 {v1}': ['取消{v0}订阅 {v1}', 'Unsubscribe {v0} from {v1}'],
  频道: ['频道', 'Channel'],
  模式: ['模式', 'Mode'],
  发布消息需先解锁当前会话写入: [
    '发布消息需先解锁当前会话写入',
    'Unlock session writes before publishing',
  ],
  发布时预览完整频道与消息字节: [
    '发布时预览完整频道与消息字节',
    'Preview complete channel and message bytes before publishing',
  ],
  发布消息: ['发布消息', 'Publish message'],
  '已发布 · Redis 接收计数 {v0}': [
    '已发布 · Redis 接收计数 {v0}',
    'Published · Redis receiver count {v0}',
  ],
  'Redis Pub/Sub': ['Redis 发布订阅', 'Redis Pub/Sub'],
});
