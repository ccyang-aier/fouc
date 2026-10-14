import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  databaseExportParametersMustBeAnObject: [
    '数据库导出参数必须是对象',
    'Database export parameters must be an object',
  ],
  databaseExportContainsUnknownParameters: [
    '数据库导出包含未知参数',
    'Database export contains unknown parameters',
  ],
  invalidExportObjectName: ['导出对象名称无效', 'Invalid export object name'],
  chooseSchemas: ['请选择 1–64 个 Schema', 'Choose 1–64 schemas'],
  chooseAtMostTablesViews: ['最多选择 1000 张表 / 视图', 'Choose at most 1,000 tables / views'],
  invalidOrDuplicateTableScope: ['表范围无效或重复', 'Invalid or duplicate table scope'],
  chooseASupportedExportFormat: ['请选择真实支持的导出格式', 'Choose a supported export format'],
  chooseStructureOrData: ['请选择结构或数据', 'Choose structure or data'],
  nativeStructureScriptsSupportOnlySqlCsvJson: [
    '原生结构脚本仅支持 SQL 格式；CSV / JSON 格式可导出完整数据',
    'Native structure scripts support only SQL; CSV / JSON can export complete data',
  ],
  invalidExportPackagingMethod: ['导出打包方式无效', 'Invalid export packaging method'],
  eachPackageMustBeMib: ['每个分包须为 1–256 MiB', 'Each package must be 1–256 MiB'],
  splitPackagesRequireAZipContainer: [
    '分包需要 ZIP 容器',
    'Split packages require a ZIP container',
  ],
  readRowsPerPage: ['每页读取须为 1–1000 行', 'Read 1–1,000 rows per page'],
  theExplicitPerTableRowRangeMustBe: [
    '显式每表行数范围须为 1–100000000',
    'The explicit per-table row range must be 1–100,000,000',
  ],
});
