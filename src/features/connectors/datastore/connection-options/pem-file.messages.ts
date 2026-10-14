import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  pemFilesMustNotExceedKib: ['PEM 文件不能超过 256 KiB', 'PEM files must not exceed 256 KiB'],
  theFileCannotBeReadAsUtfTextChooseA: [
    '文件无法读取为 UTF-8 文本，请选择 PEM 文件',
    'The file cannot be read as UTF-8 text. Choose a PEM file',
  ],
  thePemFileContainsInvalidCharacters: [
    'PEM 文件包含无效字符',
    'The PEM file contains invalid characters',
  ],
  chooseAPemClientPrivateKey: ['请选择 PEM 格式的客户端私钥', 'Choose a PEM client private key'],
  chooseAPemCertificateFile: ['请选择 PEM CERTIFICATE 证书文件', 'Choose a PEM CERTIFICATE file'],
});
