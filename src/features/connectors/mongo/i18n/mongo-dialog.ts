import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '连接成功 · MongoDB {v0} · {v1}': [
    '连接成功 · MongoDB {v0} · {v1}',
    'Connected · MongoDB {v0} · {v1}',
  ],
  版本未知: ['版本未知', 'Unknown version'],
  连接操作失败: ['连接操作失败', 'Connection action failed'],
  '编辑 MongoDB 连接': ['编辑 MongoDB 连接', 'Edit MongoDB connection'],
  '新建 MongoDB 连接': ['新建 MongoDB 连接', 'New MongoDB connection'],
  连接名称: ['连接名称', 'Connection name'],
  'DNS SRV 连接': ['DNS SRV 连接', 'DNS SRV connection'],
  'MongoDB 主机列表': ['MongoDB 主机列表', 'MongoDB hosts'],
  切换为单主机: ['切换为单主机', 'Switch to a single host'],
  主机: ['主机', 'Host'],
  端口: ['端口', 'Port'],
  用户名: ['用户名', 'Username'],
  初始数据库: ['初始数据库', 'Initial database'],
  认证数据库: ['认证数据库', 'Authentication database'],
  连接密码: ['连接密码', 'Connection password'],
  '密码临时保留以便直接打开工作台，不写入连接配置。': [
    '密码临时保留以便直接打开工作台，不写入连接配置。',
    'The password is retained temporarily for opening the workbench and is not saved in the connection configuration.',
  ],
  保存连接: ['保存连接', 'Save connection'],
});
