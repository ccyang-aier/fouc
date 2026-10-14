import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  'Redis 实时响应帧超过传输上限': [
    'Redis 实时响应帧超过传输上限',
    'Redis live response frame exceeds the transport limit',
  ],
  'Redis 实时响应帧未完整接收': [
    'Redis 实时响应帧未完整接收',
    'Redis live response frame was incomplete',
  ],
  'Redis 实时连接失败 ({v0})': ['Redis 实时连接失败 ({v0})', 'Redis live connection failed ({v0})'],
  'Redis 实时响应流不可用': ['Redis 实时响应流不可用', 'Redis live response stream unavailable'],
  'Redis 实时连接已结束': ['Redis 实时连接已结束', 'Redis live connection ended'],
  'Redis 实时读取已取消': ['Redis 实时读取已取消', 'Redis live read canceled'],
});
