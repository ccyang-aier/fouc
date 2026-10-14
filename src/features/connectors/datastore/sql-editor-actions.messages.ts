import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  sqlIsBeingParsedTryAgainShortly: [
    'SQL 正在解析，请稍后再试',
    'SQL is being parsed. Try again shortly',
  ],
  foldAllSql: ['折叠全部 SQL', 'Fold all SQL'],
  unfoldAllSql: ['展开全部 SQL', 'Unfold all SQL'],
  toggleSqlKeywordCase: ['切换 SQL 关键字大小写', 'Toggle SQL keyword case'],
  toggleSqlKeywordCaseSelectionFirst: [
    '切换 SQL 关键字大小写 · 选区优先',
    'Toggle SQL keyword case · selection first',
  ],
  sqlWordWrap: ['SQL 自动换行', 'SQL word wrap'],
  sqlSemanticDiagnostics: ['SQL 语义诊断', 'SQL semantic diagnostics'],
  sqlSyntaxAndSemanticHintsEnabled: [
    'SQL 语法与语义提示已开启',
    'SQL syntax and semantic hints enabled',
  ],
  sqlSyntaxAndSemanticHintsDisabled: [
    'SQL 语法与语义提示已关闭',
    'SQL syntax and semantic hints disabled',
  ],
});
