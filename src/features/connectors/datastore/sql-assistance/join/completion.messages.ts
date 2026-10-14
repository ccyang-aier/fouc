import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  theForeignKeyStructureReturnedADifferentTargetOrExceeded: [
    '外键结构返回了不同目标或超过辅助读取上限',
    'The foreign key structure returned a different target or exceeded the assistance read limit',
  ],
  onlyTablesReferencedInTheCurrentQueryBlockAreChecked: [
    '仅检查当前查询块中已引用的表。',
    'Only tables referenced in the current query block are checked.',
  ],
  candidatesInTheCurrentSchemaAndForeignKeyTargetsOf: [
    '当前 Schema 候选及已引用表的外键目标：检查 {p0} 张候选表，单次上限 {p1}；未加载的反向关系不推测。',
    'Candidates in the current schema and foreign key targets of referenced tables: {p0} candidate tables checked, with a per-read limit of {p1}; unloaded reverse relationships are not inferred.',
  ],
});
