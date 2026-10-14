import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '导出达到 1 GiB 上限，文件不完整': [
    '导出达到 1 GiB 上限，文件不完整',
    'Export reached the 1 GiB limit; the file is incomplete',
  ],
  '浏览器下载回退最多 64 MiB，已停止读取；请缩小范围或使用支持流式保存的浏览器': [
    '浏览器下载回退最多 64 MiB，已停止读取；请缩小范围或使用支持流式保存的浏览器',
    'Browser download fallback is limited to 64 MiB and reading has stopped. Narrow the scope or use a browser with streaming save support.',
  ],
  'MongoDB 文档导出请求失败 ({v0})': [
    'MongoDB 文档导出请求失败 ({v0})',
    'MongoDB document export request failed ({v0})',
  ],
  浏览器没有提供可读取的下载流: [
    '浏览器没有提供可读取的下载流',
    'The browser provides no readable download stream',
  ],
});
