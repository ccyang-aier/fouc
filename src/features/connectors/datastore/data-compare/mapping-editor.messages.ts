import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  comparedColumnsAndMatchingKeys: ['比较列与匹配键', 'Compared columns and matching keys'],
  columnMappingsAndMatchingKeys: ['列映射与匹配键', 'Column mappings and matching keys'],
  matchingKeysMustUniquelyIdentifyRowsMultipleColumnsMayBe: [
    '匹配键必须能唯一标识行，可选择多个列',
    'Matching keys must uniquely identify rows; multiple columns may be selected',
  ],
  useKnownPrimaryKeys: ['使用已知主键', 'Use known primary keys'],
  useAsAMatchingKey: ['{p0} 作为匹配键', 'Use {p0} as a matching key'],
  key: ['键', 'Key'],
  leftColumnFor: ['{p0} 左侧列', 'Left column for {p0}'],
  unknownType: ['未知类型', 'Unknown type'],
  rightColumnFor: ['{p0} 右侧列', 'Right column for {p0}'],
  removeMapping: ['移除 {p0} 映射', 'Remove mapping {p0}'],
  addColumnMapping: ['添加列映射', 'Add column mapping'],
  columnPairs: ['对列 ·', ' column pairs · '],
  matchingKeys: ['{p0} 个匹配键', '{p0} matching keys'],
  noMatchingKeySelected: ['尚未选择匹配键', 'No matching key selected'],
});
