import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  completeSourceCopied: ['完整源码已复制', 'Complete source copied'],
  copyFailedSelectTheSourceManually: [
    '复制失败，请手动选择源码',
    'Copy failed. Select the source manually',
  ],
  completeSourceDownloaded: ['完整源码已下载', 'Complete source downloaded'],
  copy: ['复制', 'Copy'],
  downloadSql: ['下载 .sql', 'Download .sql'],
  unknownSource: ['源码未知', 'Unknown source'],
  notProvidedByTheCurrentCatalogOrTheCurrentPrincipal: [
    '当前目录未提供，或当前主体无读取权限。',
    'Not provided by the current catalog, or the current principal lacks read permission.',
  ],
});
