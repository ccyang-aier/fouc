import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  theEncryptionPassphrasesDoNotMatch: [
    '两次输入的加密口令不一致',
    'The encryption passphrases do not match',
  ],
  encrypted: ['加密', 'encrypted'],
  publicJson: ['公开 JSON', 'public JSON'],
  generatedAConfigurationFileForConnections: [
    '已生成 {p0} 个连接的{p1}配置文件',
    'Generated a {p1} configuration file for {p0} connections',
  ],
  couldNotExportConfigurations: ['配置导出失败', 'Could not export configurations'],
  exportConnectionConfigurations: ['导出连接配置', 'Export connection configurations'],
  currentDirectory: ['当前目录 ·', 'Current directory · '],
  connectionsNoPasswordsCertificatesOrPrivateKeysAreIncluded: [
    '个连接 · 文件不包含密码、证书或私钥',
    ' connections · No passwords, certificates or private keys are included',
  ],
  selectAll: ['选择全部', 'Select all'],
  selected: ['已选择', 'Selected '],
  items: ['个', ' items'],
  encryptTheConfigurationFileWithAPassphrase: [
    '使用口令加密配置文件',
    'Encrypt the configuration file with a passphrase',
  ],
  encryptionPassphrase: ['加密口令', 'Encryption passphrase'],
  atLeastCharacters: ['至少 12 个字符', 'At least 12 characters'],
  repeatPassphrase: ['再次输入口令', 'Repeat passphrase'],
  publicJsonExposesConnectionNamesAddressesAndUsernamesCheckWhere: [
    '公开 JSON 会显示连接名称、地址和用户名，请确认文件的接收位置。',
    'Public JSON exposes connection names, addresses and usernames. Check where you send the file.',
  ],
  theTargetDeviceStillNeedsConnectionPasswordsAndRequiredCertificate: [
    '目标设备仍需重新提供连接密码及所需证书文件。加密口令只用于当前操作，请自行妥善保管。',
    'The target device still needs connection passwords and required certificate files. The encryption passphrase is used only for this operation; keep it securely.',
  ],
  connections: ['个连接', ' connections'],
  cancelExport: ['取消导出', 'Cancel export'],
  close: ['关闭', 'Close'],
  encrypting: ['正在加密…', 'Encrypting…'],
  downloadConfigurationFile: ['下载配置文件', 'Download configuration file'],
});
