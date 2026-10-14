import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  已完成: ['已完成', 'Completed'],
  审核计划: ['审核计划', 'Review plan'],
  编辑操作: ['编辑操作', 'Edit operation'],
  新集合: ['新集合', 'New collection'],
  '关闭{v0}': ['关闭{v0}', 'Close {v0}'],
  原生操作已确认: ['原生操作已确认', 'Native operation confirmed'],
  '确认影响 {v0} 项': ['确认影响 {v0} 项', 'Confirm {v0} affected items'],
  输入集合名称确认删除: ['输入集合名称确认删除', 'Enter collection name to confirm deletion'],
  集合名称: ['集合名称', 'Collection name'],
  'MongoDB 新集合名称': ['MongoDB 新集合名称', 'New MongoDB collection name'],
  '文档 · Extended JSON': ['文档 · Extended JSON', 'Document · Extended JSON'],
  '保留 BSON 类型：{"$numberLong":"9007199254740993"}、{"$numberDecimal":"12.3400"}。字符串不会被解释为脚本。':
    [
      '保留 BSON 类型：{"$numberLong":"9007199254740993"}、{"$numberDecimal":"12.3400"}。字符串不会被解释为脚本。',
      'Preserves BSON types: {"$numberLong":"9007199254740993"}, {"$numberDecimal":"12.3400"}. Strings are never interpreted as scripts.',
    ],
  '将替换整个文档。未保留的字段会删除，_id 的值与类型必须保持一致。': [
    '将替换整个文档。未保留的字段会删除，_id 的值与类型必须保持一致。',
    'Replaces the entire document. Fields not retained will be deleted; the _id value and type must stay unchanged.',
  ],
  '预览会重新读取完整原始 BSON 文档。确认提交后仅删除该文档，内容变化会阻止操作。': [
    '预览会重新读取完整原始 BSON 文档。确认提交后仅删除该文档，内容变化会阻止操作。',
    'Preview rereads the complete original BSON document. Confirmation deletes only this document; content changes prevent the operation.',
  ],
  '此操作会删除集合的全部文档和索引。先查看原生元数据与影响数量，再输入集合名确认。': [
    '此操作会删除集合的全部文档和索引。先查看原生元数据与影响数量，再输入集合名确认。',
    'This operation deletes every document and index in the collection. Review native metadata and affected counts, then enter the collection name to confirm.',
  ],
  将删除索引: ['将删除索引', 'Will delete index'],
  '。预览会核对完整索引定义；_id 主索引不能删除。': [
    '。预览会核对完整索引定义；_id 主索引不能删除。',
    '. Preview verifies the complete index definition; the _id primary index cannot be deleted.',
  ],
  索引字段与方向: ['索引字段与方向', 'Index fields and directions'],
  '字段顺序决定复合索引顺序。方向支持 1、-1、text、hashed、2d、2dsphere。': [
    '字段顺序决定复合索引顺序。方向支持 1、-1、text、hashed、2d、2dsphere。',
    'Field order determines compound index order. Directions support 1, -1, text, hashed, 2d and 2dsphere.',
  ],
  索引选项: ['索引选项', 'Index options'],
  集合选项: ['集合选项', 'Collection options'],
  '可设置 name、unique、sparse、hidden、TTL、partialFilterExpression、collation 等选项。省略 name 时按字段自动命名。':
    [
      '可设置 name、unique、sparse、hidden、TTL、partialFilterExpression、collation 等选项。省略 name 时按字段自动命名。',
      'Options include name, unique, sparse, hidden, TTL, partialFilterExpression and collation. Omitting name generates one from the fields.',
    ],
  '默认创建普通空集合。可设置 capped / size / max、validator、validationLevel、validationAction、collation。':
    [
      '默认创建普通空集合。可设置 capped / size / max、validator、validationLevel、validationAction、collation。',
      'Creates a regular empty collection by default. Options include capped / size / max, validator, validationLevel, validationAction and collation.',
    ],
  '正在核对当前目标与 BSON 内容…': [
    '正在核对当前目标与 BSON 内容…',
    'Verifying the current target and BSON content…',
  ],
  '正在提交，请等待原生写入确认…': [
    '正在提交，请等待原生写入确认…',
    'Submitting. Wait for native write confirmation…',
  ],
  已完成原生确认: ['已完成原生确认', 'Native confirmation completed'],
  完成: ['完成', 'Done'],
  返回编辑: ['返回编辑', 'Back to editing'],
  取消: ['取消', 'Cancel'],
  本计划仅可提交一次: ['本计划仅可提交一次', 'This plan can be submitted only once'],
  '先预览，再确认提交': ['先预览，再确认提交', 'Preview first, then confirm submission'],
  '提交中…': ['提交中…', 'Committing…'],
  '确认{v0}': ['确认{v0}', 'Confirm {v0}'],
  预览操作: ['预览操作', 'Preview operation'],
});
