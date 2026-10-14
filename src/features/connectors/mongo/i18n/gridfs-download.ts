import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  'GridFS 下载超过已核对长度或浏览器内存限额': [
    'GridFS 下载超过已核对长度或浏览器内存限额',
    'GridFS download exceeds the verified length or browser memory limit',
  ],
  'GridFS 下载不完整，请重新读取文件后重试': [
    'GridFS 下载不完整，请重新读取文件后重试',
    'GridFS download incomplete. Read the file again and retry.',
  ],
  'GridFS 文件没有有效长度': ['GridFS 文件没有有效长度', 'GridFS file has no valid length'],
  '单文件下载最多 1 GiB；文件详情仍可查看': [
    '单文件下载最多 1 GiB；文件详情仍可查看',
    'Downloads are limited to 1 GiB per file; file details remain available',
  ],
  '此浏览器不支持直接流式保存，内存下载最多 64 MiB。请使用支持文件保存的 Chrome / Edge 下载此文件。':
    [
      '此浏览器不支持直接流式保存，内存下载最多 64 MiB。请使用支持文件保存的 Chrome / Edge 下载此文件。',
      'This browser cannot save streams directly; memory downloads are limited to 64 MiB. Use Chrome / Edge with file saving support for this file.',
    ],
  'GridFS 下载请求失败 ({v0})': [
    'GridFS 下载请求失败 ({v0})',
    'GridFS download request failed ({v0})',
  ],
  当前浏览器未提供可读取的下载流: [
    '当前浏览器未提供可读取的下载流',
    'This browser does not provide a readable download stream',
  ],
  '文件长度已变化，请刷新列表后重新下载': [
    '文件长度已变化，请刷新列表后重新下载',
    'File length changed. Refresh the list before downloading again.',
  ],
});
