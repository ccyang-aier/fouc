import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '连接成功 · Redis {v0} · DB {v1}': [
    '连接成功 · Redis {v0} · DB {v1}',
    'Connected · Redis {v0} · DB {v1}',
  ],
  版本未知: ['版本未知', 'Unknown version'],
  连接操作失败: ['连接操作失败', 'Connection action failed'],
  '编辑 Redis 连接': ['编辑 Redis 连接', 'Edit Redis connection'],
  '新建 Redis 连接': ['新建 Redis 连接', 'New Redis connection'],
  连接名称: ['连接名称', 'Connection name'],
  主机: ['主机', 'Host'],
  端口: ['端口', 'Port'],
  'ACL 用户名': ['ACL 用户名', 'ACL username'],
  默认用户可留空: ['默认用户可留空', 'Default user may be empty'],
  数据库编号: ['数据库编号', 'Database number'],
  连接密码: ['连接密码', 'Connection password'],
  '密码临时保留以便直接打开工作台，不写入连接配置。': [
    '密码临时保留以便直接打开工作台，不写入连接配置。',
    'The password is retained temporarily for opening the workbench and is not saved in the connection configuration.',
  ],
  '支持 Standalone 连接。数据库索引由服务器实际配置决定。': [
    '支持 Standalone 连接。数据库索引由服务器实际配置决定。',
    'Supports Standalone connections. Database indexes depend on the actual server configuration.',
  ],
  保存连接: ['保存连接', 'Save connection'],
});
