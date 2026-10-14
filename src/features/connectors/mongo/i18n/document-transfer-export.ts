import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  已完成流式保存: ['已完成流式保存', 'Streaming save completed'],
  '导出完成，浏览器已开始保存文件': [
    '导出完成，浏览器已开始保存文件',
    'Export completed. The browser has started saving the file.',
  ],
  '导出已取消；未完成的流式文件不会作为成功结果。': [
    '导出已取消；未完成的流式文件不会作为成功结果。',
    'Export canceled; incomplete streamed files are not successful results.',
  ],
  '每行一个完整 BSON 文档，保留 ObjectId、Int64、Decimal128、日期与二进制类型。': [
    '每行一个完整 BSON 文档，保留 ObjectId、Int64、Decimal128、日期与二进制类型。',
    'One complete BSON document per line, preserving ObjectId, Int64, Decimal128, dates and binary types.',
  ],
  读取范围: ['读取范围', 'Read scope'],
  导出已应用筛选: ['导出已应用筛选', 'Export the applied filter'],
  '使用当前已应用的筛选与排序，包含完整字段；实时游标读取，不提供一致性快照。': [
    '使用当前已应用的筛选与排序，包含完整字段；实时游标读取，不提供一致性快照。',
    'Uses the currently applied filter and sort with complete fields. Live cursor reads do not provide a consistent snapshot.',
  ],
  导出范围: ['导出范围', 'Export scope'],
  文档导出范围: ['文档导出范围', 'Document export scope'],
  所有匹配文档: ['所有匹配文档', 'All matching documents'],
  '仅前 N 个匹配文档': ['仅前 N 个匹配文档', 'First N matching documents only'],
  最多文档数: ['最多文档数', 'Maximum documents'],
  文档导出数量: ['文档导出数量', 'Document export count'],
  '独立游标按需读取，服务端最多 1 GiB / 10 分钟。支持文件系统保存时直接写入磁盘；浏览器下载回退最多 64 MiB。此文件不包含索引、集合选项或完整数据库备份。':
    [
      '独立游标按需读取，服务端最多 1 GiB / 10 分钟。支持文件系统保存时直接写入磁盘；浏览器下载回退最多 64 MiB。此文件不包含索引、集合选项或完整数据库备份。',
      'An independent cursor reads on demand, limited to 1 GiB / 10 minutes on the server. Writes directly to disk with file-system saving support; browser download fallback is limited to 64 MiB. This file excludes indexes, collection options and complete database backups.',
    ],
  个文档: ['个文档', 'documents'],
  '正在读取并保存…': ['正在读取并保存…', 'Reading and saving…'],
  已停止: ['已停止', 'Stopped'],
  'UTF-8 · NDJSON · 保留 BSON 类型': [
    'UTF-8 · NDJSON · 保留 BSON 类型',
    'UTF-8 · NDJSON · Preserves BSON types',
  ],
  取消导出: ['取消导出', 'Cancel export'],
  '下载 NDJSON': ['下载 NDJSON', 'Download NDJSON'],
});
