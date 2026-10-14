import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  draftLoadFailure: ['{reason}', '{reason}'],
  deviceDraftHasNotLoaded: ['设备草稿尚未加载', 'Device draft has not loaded'],
  thisConnectionHasNoDeviceDraftStorage: [
    '当前连接没有设备草稿存储',
    'This connection has no device draft storage',
  ],
  waitForTheCurrentDraftToFinishSavingBeforeRestoring: [
    '等待当前草稿保存结束后再恢复',
    'Wait for the current draft to finish saving before restoring',
  ],
});
