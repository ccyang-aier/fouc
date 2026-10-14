import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  '字段转换须为 /字段/路径:类型，每行一项，例如 /amount:decimal128': [
    '字段转换须为 /字段/路径:类型，每行一项，例如 /amount:decimal128',
    'Use /field/path:type for conversions, one per line, for example /amount:decimal128',
  ],
  '选择非空 UTF-8 文件；{v0} 最大 {v1} MiB': [
    '选择非空 UTF-8 文件；{v0} 最大 {v1} MiB',
    'Choose a nonempty UTF-8 file; {v0} supports up to {v1} MiB',
  ],
  '文件不是有效 UTF-8，未截断或替换无效字节': [
    '文件不是有效 UTF-8，未截断或替换无效字节',
    'File is not valid UTF-8; invalid bytes were not truncated or replaced',
  ],
  '先修正 CSV/TSV 解析错误，再生成完整预览': [
    '先修正 CSV/TSV 解析错误，再生成完整预览',
    'Fix CSV/TSV parsing errors before generating a full preview',
  ],
  '预览已取消，未执行写入': ['预览已取消，未执行写入', 'Preview canceled; no writes executed'],
  '请求连接中断，服务器仍在等待本批确认。请停止后续批次并核对目标集合，不要重复提交。': [
    '请求连接中断，服务器仍在等待本批确认。请停止后续批次并核对目标集合，不要重复提交。',
    'Request connection interrupted; the server is still awaiting batch confirmation. Stop subsequent batches and verify the target collection. Do not submit again.',
  ],
  '无法确认导入结果，请核对目标集合，不要重复提交。{v0}': [
    '无法确认导入结果，请核对目标集合，不要重复提交。{v0}',
    'Import results could not be confirmed. Verify the target collection and do not submit again. {v0}',
  ],
  '验证文件，然后审查追加': ['验证文件，然后审查追加', 'Validate file, then review append'],
  目标: ['目标', 'Goals'],
  '· UTF-8 CSV / TSV、JSON 和 NDJSON。': [
    '· UTF-8 CSV / TSV、JSON 和 NDJSON。',
    '· UTF-8 CSV / TSV, JSON and NDJSON.',
  ],
  '生成新 ObjectId': ['生成新 ObjectId', 'Generate new ObjectId'],
  '保留原生 _id': ['保留原生 _id', 'Preserve native _id'],
  ' · 显式字段转换': [' · 显式字段转换', ' · Explicit field conversion'],
  修改配置: ['修改配置', 'Edit configuration'],
  选择文档文件: ['选择文档文件', 'Choose document files'],
  '{v0} KiB · 已完整读取': ['{v0} KiB · 已完整读取', '{v0} KiB · Fully read'],
  'CSV / TSV 最大 5 MiB · JSON / NDJSON 最大 32 MiB': [
    'CSV / TSV 最大 5 MiB · JSON / NDJSON 最大 32 MiB',
    'CSV / TSV up to 5 MiB · JSON / NDJSON up to 32 MiB',
  ],
  '选择 MongoDB 文档导入文件': ['选择 MongoDB 文档导入文件', 'Select MongoDB document import file'],
  文件格式: ['文件格式', 'File format'],
  文档导入格式: ['文档导入格式', 'Document import format'],
  'CSV · 可配置分隔符': ['CSV · 可配置分隔符', 'CSV · Configurable delimiter'],
  'TSV · 制表符': ['TSV · 制表符', 'TSV · Tabs'],
  'NDJSON · 每行一个文档': ['NDJSON · 每行一个文档', 'NDJSON · One document per line'],
  'JSON · 对象或对象数组': ['JSON · 对象或对象数组', 'JSON · Object or object array'],
  '_id 处理': ['_id 处理', '_id handling'],
  '导入文档 ID 策略': ['导入文档 ID 策略', 'Imported document ID policy'],
  '保留原生 _id；缺少时生成': [
    '保留原生 _id；缺少时生成',
    'Preserve native _id; generate when missing',
  ],
  '忽略原 _id，生成新 ObjectId': [
    '忽略原 _id，生成新 ObjectId',
    'Ignore original _id; generate a new ObjectId',
  ],
  显式字段类型转换: ['显式字段类型转换', 'Explicit field type conversion'],
  '可选 · 每行一个 JSON Pointer': [
    '可选 · 每行一个 JSON Pointer',
    'Optional · One JSON Pointer per line',
  ],
  导入字段类型转换: ['导入字段类型转换', 'Import field type conversions'],
  '数组使用 /items/0；~1 转义 /，~0 转义 ~。支持': [
    '数组使用 /items/0；~1 转义 /，~0 转义 ~。支持',
    'Use /items/0 for arrays; ~1 escapes / and ~0 escapes ~. Supports',
  ],
  '。缺少字段保持缺少，null 保持 null。': [
    '。缺少字段保持缺少，null 保持 null。',
    '. Missing fields remain missing; null remains null.',
  ],
  'CSV/TSV 最多 5 MiB、5000 行、256 列和 100000 个单元格。采样只给出建议，全部类型须明确选择；Int64 / Decimal128 保留数字原文，EJSON 单元格可携带嵌套对象与 BSON 类型。':
    [
      'CSV/TSV 最多 5 MiB、5000 行、256 列和 100000 个单元格。采样只给出建议，全部类型须明确选择；Int64 / Decimal128 保留数字原文，EJSON 单元格可携带嵌套对象与 BSON 类型。',
      'CSV/TSV supports up to 5 MiB, 5,000 rows, 256 columns and 100,000 cells. Sampling provides suggestions only; choose every type explicitly. Int64 / Decimal128 preserve numeric source text. EJSON cells can contain nested objects and BSON types.',
    ],
  '每次最多 5000 个文档、32 MiB；Canonical EJSON 保留 BSON 类型。普通 JSON 大整数须使用 $numberLong 或数字字符串再指定转换。':
    [
      '每次最多 5000 个文档、32 MiB；Canonical EJSON 保留 BSON 类型。普通 JSON 大整数须使用 $numberLong 或数字字符串再指定转换。',
      'Up to 5,000 documents and 32 MiB per operation. Canonical EJSON preserves BSON types. Large JSON integers require $numberLong, or numeric strings with an explicit conversion.',
    ],
  '单文档最多 256 KiB。生成新 _id 时原 _id 列明确跳过；不支持 ZIP 或 dump。': [
    '单文档最多 256 KiB。生成新 _id 时原 _id 列明确跳过；不支持 ZIP 或 dump。',
    'Up to 256 KiB per document. When generating a new _id, the original _id column is explicitly skipped. ZIP and dump are not supported.',
  ],
  停止后续批次: ['停止后续批次', 'Stop subsequent batches'],
  刷新写入结果: ['刷新写入结果', 'Refresh write results'],
  向: ['向', 'to'],
  追加全部: ['追加全部', 'Append all'],
  '个文档；保留已成功写入，不覆盖已有文档。': [
    '个文档；保留已成功写入，不覆盖已有文档。',
    'documents; successful writes are retained and existing documents are not overwritten.',
  ],
  '完整读取文件…': ['完整读取文件…', 'Reading complete file…'],
  '验证全部文档并读取服务器…': [
    '验证全部文档并读取服务器…',
    'Validating all documents and reading the server…',
  ],
  '每批最多 100 个，等待服务器确认': [
    '每批最多 100 个，等待服务器确认',
    'Up to 100 per batch; waits for server confirmation',
  ],
  '一次性计划 · 5 分钟内有效': [
    '一次性计划 · 5 分钟内有效',
    'Single-use plan · Valid for 5 minutes',
  ],
  预览不写入数据库: ['预览不写入数据库', 'Preview does not write to the database'],
  取消预览: ['取消预览', 'Cancel preview'],
  解锁写入: ['解锁写入', 'Unlock writes'],
  重新预览: ['重新预览', 'Preview again'],
  完整验证与预览: ['完整验证与预览', 'Full validation and preview'],
  确认追加: ['确认追加', 'Confirm append'],
  个文档: ['个文档', 'documents'],
});
