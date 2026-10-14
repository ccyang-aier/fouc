import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  bidirectionalForeignKeyRelationships: ['双向外键关系', 'Bidirectional foreign key relationships'],
  referencesOtherTables: ['引用其他表', 'References other tables'],
  referencedByOtherTables: ['被其他表引用', 'Referenced by other tables'],
  nullable: [' · 可空', ' · Nullable'],
  theTargetWasNotConfirmedInTheCurrentSnapshot: [
    '目标未在当前快照中确认',
    'The target was not confirmed in the current snapshot',
  ],
  theNativeCatalogRecordsNoForeignKeysInThisDirection: [
    '原生目录未记录此方向的外键。',
    'The native catalog records no foreign keys in this direction.',
  ],
});
