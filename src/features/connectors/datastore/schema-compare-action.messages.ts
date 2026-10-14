import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  compareTableStructures: ['比较表结构', 'Compare table structures'],
  compareStructure: ['比较结构', 'Compare structure'],
  changeSource: ['修改来源', 'Change source'],
  referenceSchema: ['参考 Schema', 'Reference schema'],
  structureComparisonReferenceSchema: [
    '结构比较参考 Schema',
    'Structure comparison reference schema',
  ],
  referenceTable: ['参考表', 'Reference table'],
  structureComparisonReferenceTable: ['结构比较参考表', 'Structure comparison reference table'],
  selectAReferenceTable: ['选择参考表', 'Select a reference table'],
  currentTarget: ['当前目标', 'Current target'],
  generateAReviewScriptToMatchTheTargetToThe: [
    '生成将目标调整为参考结构的审查脚本',
    'Generate a review script to match the target to the reference structure',
  ],
  readingStructure: ['读取结构…', 'Reading structure…'],
  compareAgain: ['重新比较', 'Compare again'],
  readAndCompare: ['读取并比较', 'Read and compare'],
  readingActualStructuresForBothObjects: [
    '正在读取两个对象的真实结构…',
    'Reading actual structures for both objects…',
  ],
  selectAReferenceTableToCompareColumnsIndexesConstraintsAnd: [
    '选择参考表后比较字段、索引、约束与原始 DDL。',
    'Select a reference table to compare columns, indexes, constraints and original DDL.',
  ],
});
