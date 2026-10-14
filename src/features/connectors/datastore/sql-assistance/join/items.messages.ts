import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  nativeForeignKeyUsingMatchingColumns: [
    '真实外键 · USING 同名列',
    'Native foreign key · USING matching columns',
  ],
  compositeForeignKeyOnCondition: ['复合外键 · ON 条件', 'Composite foreign key · ON condition'],
  nativeForeignKeyOnCondition: ['真实外键 · ON 条件', 'Native foreign key · ON condition'],
  referencedTarget: ['引用目标', 'Referenced target'],
  referencedTable: ['被引用表', 'Referenced table'],
  compositeForeignKey: ['复合外键', 'Composite foreign key'],
  actualForeignKey: ['真实外键', 'Actual foreign key'],
});
