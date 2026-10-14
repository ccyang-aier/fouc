import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  webcryptoIsUnavailableInThisBrowserOpenOver: [
    '当前浏览器未提供 WebCrypto；请使用 HTTPS 或 localhost 打开后进行加密操作',
    'WebCrypto is unavailable in this browser. Open over HTTPS or localhost for encryption',
  ],
  encryptionPasswordsMustContainCharacters: [
    '加密口令须为 12–1024 个字符',
    'Encryption passwords must contain 12–1,024 characters',
  ],
  encryptedConfigurationContainsInvalidBaseData: [
    '加密配置包含无效 Base64 数据',
    'Encrypted configuration contains invalid Base64 data',
  ],
  invalidEncryptedConfigurationLengthOrEncoding: [
    '加密配置长度或编码无效',
    'Invalid encrypted configuration length or encoding',
  ],
  encryptedConfigurationMustBeAnObject: [
    '加密配置须为对象',
    'Encrypted configuration must be an object',
  ],
  encryptedConfigurationFormatVersionOrEncryptionParametersAre: [
    '加密配置格式、版本或加密参数不受支持',
    'Encrypted configuration format, version, or encryption parameters are unsupported',
  ],
  configurationFilesMustNotExceedMib: [
    '配置文件不能超过 3 MiB',
    'Configuration files must not exceed 3 MiB',
  ],
  configurationFileIsNotValidJson: [
    '配置文件不是有效 JSON',
    'Configuration file is not valid JSON',
  ],
  decryptionFailedThePasswordIsIncorrectOrThe: [
    '解密失败：口令不正确或文件已被修改；未导入任何连接',
    'Decryption failed: the password is incorrect or the file was modified. No connections were imported',
  ],
  decryptedConfigurationIsNotValidUtfText: [
    '解密后的配置不是有效 UTF-8 文本',
    'Decrypted configuration is not valid UTF-8 text',
  ],
});
