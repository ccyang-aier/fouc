import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  sqlCopied: ['SQL 已复制。', 'SQL copied.'],
  clipboardAccessIsUnavailableSelectTheSourceInTheEditor: [
    '无法访问剪贴板，可在编辑器中选择源码复制。',
    'Clipboard access is unavailable. Select the source in the editor to copy it.',
  ],
  sqlFileGenerated: ['SQL 文件已生成。', 'SQL file generated.'],
  nativeSource: ['原生源码', 'Native source'],
  declarationReconstructedFromMetadata: [
    '元数据重建声明',
    'Declaration reconstructed from metadata',
  ],
  unknownSource: ['源码未知', 'Unknown source'],
  fragment: [' · 片段', ' · Fragment'],
  copy: ['复制{p0}', 'Copy {p0}'],
  copySql: ['复制 SQL', 'Copy SQL'],
  download: ['下载{p0}', 'Download {p0}'],
  download271: ['下载', 'Download'],
  source: ['{p0}源码', '{p0} source'],
  theNativeCatalogDoesNotProvideThisSourceOrThe: [
    '原生目录未提供此源码，或当前角色没有读取权限。',
    'The native catalog does not provide this source, or the current role lacks read permission.',
  ],
});
