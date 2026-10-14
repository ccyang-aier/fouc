import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  file: ['文件', 'File'],
  connectionTarget: ['连接目标', 'Connection target'],
  loginAccount: ['登录账户', 'Login account'],
  authenticationDatabase: ['认证库', 'Authentication database'],
  notConfigured: ['未配置', 'Not configured'],
  passed: ['通过', 'passed'],
  failed: ['失败', 'Failed'],
  lastConnectionValidationThisDoesNotIndicateCurrentAvailability: [
    '上次连接验证{p0} · {p1}。不代表当前在线状态。',
    'Last connection validation {p0} · {p1}. This does not indicate current availability.',
  ],
  thisConnectionHasNotBeenValidatedTestItFirst: [
    '尚未验证此连接；请先测试连接。',
    'This connection has not been validated. Test it first.',
  ],
});
