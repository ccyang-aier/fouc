import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  couldNotGenerateTheConnectionUrl: ['连接 URL 无法生成', 'Could not generate the connection URL'],
  couldNotParseTheConnectionUrlDsn: [
    '连接 URL / DSN 无法解析',
    'Could not parse the connection URL / DSN',
  ],
  clipboardPermissionIsUnavailableSelectTheGeneratedTextToCopy: [
    '当前浏览器未提供剪贴板权限，可选中生成文本手动复制',
    'Clipboard permission is unavailable. Select the generated text to copy it manually',
  ],
  copiedConnectionTextIncludingThePassword: [
    '已复制包含密码的连接文本',
    'Copied connection text including the password',
  ],
  copiedConnectionTextWithoutThePassword: [
    '已复制连接文本，未包含密码',
    'Copied connection text without the password',
  ],
  couldNotWriteToTheClipboard: ['剪贴板写入失败', 'Could not write to the clipboard'],
  connectionUrlDsn: ['连接 URL / DSN', 'Connection URL / DSN'],
  parseAndCopy: ['解析与复制', 'Parse and copy'],
  pasteConnectionText: ['粘贴连接文本', 'Paste connection text'],
  postgresqlOrHostDbname: [
    'postgresql://… 或 host=… dbname=…',
    'postgresql://… or host=… dbname=…',
  ],
  hide: ['隐藏', 'Hide'],
  showing: ['显示', 'Showing '],
  theTextMayContainAPasswordAndIsRetainedOnly: [
    '文本可能包含密码，仅保留在当前表单。',
    'The text may contain a password and is retained only in this form.',
  ],
  parseConnectionText: ['解析连接文本', 'Parse connection text'],
  host: ['主机', 'Host'],
  database: ['数据库', 'Database'],
  notSpecified: ['未指定', 'Not specified'],
  username: ['用户名', 'Username'],
  enabledFullCertificateVerification: [
    '开启 · 完整证书校验',
    'Enabled · Full certificate verification',
  ],
  close: ['关闭', 'Close'],
  passwordParsedAfterApplyingItIsUsedOnlyForThis: [
    '已解析密码；应用后仅用于本次连接或测试。',
    'Password parsed; after applying, it is used only for this connection or test.',
  ],
  appliedToTheConnectionForm: ['已应用到连接表单', 'Applied to the connection form'],
  couldNotApplyConnectionText: ['连接文本应用失败', 'Could not apply connection text'],
  applyToForm: ['应用到表单', 'Apply to form'],
  generateFromTheCurrentForm: ['根据当前表单生成', 'Generate from the current form'],
  connectionTextFormat: ['连接文本格式', 'Connection text format'],
  connectionUrl: ['连接 URL', 'Connection URL'],
  includePasswordInCopiedText: ['在复制文本中包含密码', 'Include password in copied text'],
  theCopiedTextContainsAPasswordCheckWhereYouPaste: [
    '复制内容包含密码，请确认粘贴位置。',
    'The copied text contains a password. Check where you paste it.',
  ],
  generatedConnectionText: ['生成的连接文本', 'Generated connection text'],
  copying: ['复制中…', 'Copying…'],
  copy: ['复制{p0}', 'Copy {p0}'],
});
