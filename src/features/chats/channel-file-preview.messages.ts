import { defineMessages } from '@/lib/i18n';

export const previewMessages = defineMessages({
  preview: ['文件预览', 'File preview'], readOnly: ['只读预览', 'Read-only preview'],
  loading: ['正在打开文件…', 'Opening file…'], download: ['下载原文件', 'Download original'],
  copy: ['复制内容', 'Copy contents'], copied: ['文件内容已复制', 'File contents copied'],
  copyFailed: ['无法复制内容，请重试', 'Could not copy contents. Please try again.'],
  retry: ['重新加载', 'Reload'], unavailable: ['此格式暂不支持预览', 'Preview is unavailable for this format'],
  unavailableHelp: ['下载原文件后，使用对应应用打开。', 'Download the original file and open it with a compatible app.'],
  large: ['文件较大，请下载查看', 'This file is too large to preview'],
  largeHelp: ['文本预览支持 2 MB 以内的文件。原文件可完整下载。', 'Text previews support files up to 2 MB. The complete original is available to download.'],
  failed: ['文件未能打开', 'Could not open file'],
  failedHelp: ['请检查连接后重新加载。', 'Check your connection and reload.'],
  renderFailed: ['无法显示文件内容', 'Could not display this file'],
  renderFailedHelp: ['可以重新加载，或下载原文件查看。', 'Reload the preview or download the original file.'],
  forbidden: ['已无法访问此文件', 'You no longer have access to this file'],
  forbiddenHelp: ['请确认当前账号仍是频道成员。', 'Check that your current account is still a channel member.'],
  missing: ['文件已不在此频道中', 'This file is no longer in the channel'],
  missingHelp: ['原消息或附件可能已被移除。', 'The original message or attachment may have been removed.'],
  lines: ['{count} 行', '{count} lines'], embeddedImage: ['文档中的图片', 'Image in document'],
  actualSize: ['查看原图尺寸', 'View actual size'], fit: ['适应窗口', 'Fit to window'],
});
