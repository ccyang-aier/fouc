import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  generateTestDataForTheCurrentTable: [
    '生成当前表测试数据',
    'Generate test data for the current table',
  ],
  generateTestDataFromActualColumnsPreviewBeforeConfirmingAppend: [
    '基于真实字段生成测试数据 · 先预览再确认追加',
    'Generate test data from actual columns · preview before confirming append',
  ],
  generateData: ['生成数据', 'Generate data'],
  generateTestData: ['生成测试数据', 'Generate test data'],
  retryLoadingActualStructure: ['重试加载真实结构', 'Retry loading actual structure'],
  loadingActualColumnsDefaultsAndConstraints: [
    '正在加载真实字段、默认值与约束…',
    'Loading actual columns, defaults, and constraints…',
  ],
});
