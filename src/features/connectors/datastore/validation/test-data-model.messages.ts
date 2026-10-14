import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  databaseGeneratedColumn: ['数据库生成字段', 'Database-generated column'],
  databaseAutoIncrementSequence: ['数据库自增 / 序列', 'Database auto-increment / sequence'],
  sqliteNativeRowid: ['SQLite 原生 rowid', 'SQLite native rowid'],
  foreignKeyReferencedTablesAreNotSampledIn: [
    '外键：本批不采样引用表',
    'Foreign key: referenced tables are not sampled in this batch',
  ],
  generationIsUnsupportedForTheCurrentType: [
    '当前类型不支持生成',
    'Generation is unsupported for the current type',
  ],
});
