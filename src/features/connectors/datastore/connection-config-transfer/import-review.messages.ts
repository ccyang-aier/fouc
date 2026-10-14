import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  duplicateName: ['同名', 'Duplicate name'],
  items: ['项', ' items'],
  pending: ['待处理', 'Pending'],
  saved: ['已保存', 'Saved'],
  failed: ['失败', 'Failed'],
  skipped: ['跳过', 'Skipped'],
  cancelled: ['已取消', 'Cancelled'],
  defaultIdentity: ['默认身份', 'Default identity'],
  certificateFilesMustBeProvidedAgainWhenConnecting: [
    '连接时需重新提供证书文件',
    'Certificate files must be provided again when connecting',
  ],
  importActionForItem: ['第 {p0} 项导入操作', 'Import action for item {p0}'],
  createImportWithANewName: ['新建 / 改名导入', 'Create / Import with a new name'],
  skipThisItem: ['跳过此项', 'Skip this item'],
  replaceExistingConfigurationWithTheSameName: [
    '替换现有同名配置',
    'Replace existing configuration with the same name',
  ],
  connectionNameForItem: ['第 {p0} 项连接名称', 'Connection name for item {p0}'],
  updateTargetForItem: ['第 {p0} 项更新目标', 'Update target for item {p0}'],
  confirmingTheImportReplacesTheSelectedConnectionSPublicConfiguration: [
    '确认导入后会替换选定连接的公开配置。',
    "Confirming the import replaces the selected connection's public configuration.",
  ],
});
