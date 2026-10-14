import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  couldNotReadConnections: ['读取连接失败', 'Could not read connections'],
  connectionFailedEditItAndTestAgain: [
    '连接失败，请编辑并重新测试。',
    'Connection failed. Edit it and test again.',
  ],
  thisConnectionIsBeingSavedTryAgainShortly: [
    '此连接正在保存，请稍后再试',
    'This connection is being saved. Try again shortly',
  ],
  couldNotDelete: ['删除失败', 'Could not delete'],
  invalidTags: ['标签无效', 'Invalid tags'],
  tagUpdateFailure: ['{name}：{cause}', '{name}: {cause}'],
  couldNotSaveTheFavorite: ['收藏保存失败', 'Could not save the favorite'],
  bulkTaggingConnections: ['批量打标签 · {p0} 个连接', 'Bulk tagging · {p0} connections'],
});
