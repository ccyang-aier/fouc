import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  objectsHeading: ['对象', 'Objects'],
  nativeSchemaObjectCatalog: ['原生 Schema 对象目录', 'Native schema object catalog'],
  schemaObjects: ['Schema 对象', 'Schema objects'],
  nativeCatalog: ['· 原生目录', '· Native catalog'],
  refreshSchemaObjectCatalogAndDetails: [
    '刷新 Schema 对象目录与详情',
    'Refresh schema object catalog and details',
  ],
  searchObjectNamesCommentsOrSignatures: [
    '搜索对象名称、注释或签名',
    'Search object names, comments or signatures',
  ],
  searchNamesCommentsOrSignatures: [
    '搜索名称、注释或签名…',
    'Search names, comments or signatures…',
  ],
  all: ['全部', 'All'],
  reading: ['读取中', 'Reading'],
  items: ['{p0} 项', '{p0} items'],
  readingNativeCatalog: ['正在读取原生目录…', 'Reading native catalog…'],
  retryCatalog: ['重试目录', 'Retry catalog'],
  noMatchingObjects: ['没有匹配的对象', 'No matching objects'],
  theseObjectsAreNotPresentInTheCurrentSchema: [
    '当前 Schema 没有这些对象',
    'These objects are not present in the current schema',
  ],
  previousSchemaObjectPage: ['上一页 Schema 对象', 'Previous schema object page'],
  nextSchemaObjectPage: ['下一页 Schema 对象', 'Next schema object page'],
  readingObjectDetails: ['正在读取对象详情', 'Reading object details'],
  originalDefinitionsParametersAndReferencesComeFromTheCurrentSession: [
    '原始定义、参数与引用来自当前会话的原生目录。',
    "Original definitions, parameters and references come from the current session's native catalog.",
  ],
  reload: ['重新读取', 'Reload'],
  selectAnObject: ['选择一个对象', 'Select an object'],
  inspectCompleteDdlBodiesParametersAndCatalogReferences: [
    '查看完整 DDL、正文、参数与目录引用。',
    'Inspect complete DDL, bodies, parameters and catalog references.',
  ],
});
