import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  dataDifferenceDetails: ['数据差异详情', 'Data difference details'],
  differenceDetails: ['差异详情', 'Difference details'],
  fieldsChanged: ['{p0} 个字段变化', '{p0} fields changed'],
  adjustTheMatchingKeyOrSourceData: [
    '需要调整匹配键或原始数据',
    'Adjust the matching key or source data',
  ],
  mappedColumnsMatch: ['映射列一致', 'Mapped columns match'],
  presentOnOnlyOneSideWithinThisRange: [
    '当前范围内仅一侧存在',
    'Present on only one side within this range',
  ],
  left: ['左', 'Left'],
  right: ['右', 'Right'],
  sideDetailRow: ['{p0}侧详情行', '{p0}-side detail row'],
  notPresentInTheCurrentRange: ['当前范围不存在', 'Not present in the current range'],
  loadedResultRow: ['已加载结果第', 'Loaded result row '],
  row: ['行', ' row'],
  mappedColumn: ['映射列', 'Mapped column'],
  leftRawValue: ['左侧原始值', 'Left raw value'],
  rightRawValue: ['右侧原始值', 'Right raw value'],
  matchingKey: [' · 匹配键', ' · Matching key'],
});
