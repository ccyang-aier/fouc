import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  blockComment: ['块注释', 'Block comment'],
  quotedIdentifier: ['引用标识符', 'Quoted identifier'],
  dollarQuotedString: ['美元引用字符串', 'Dollar-quoted string'],
  string: ['字符串', 'String'],
  isNotClosed: ['{p0}尚未闭合', '{p0} is not closed'],
  closingParenthesisHasNoMatchingOpeningParenthesis: [
    '右括号没有对应的左括号',
    'Closing parenthesis has no matching opening parenthesis',
  ],
  openingParenthesisIsNotClosed: ['左括号尚未闭合', 'Opening parenthesis is not closed'],
  theCurrentCatalogConfirmsThatTableDoesNotExist: [
    '已确认当前目录不存在表 {p0}',
    'The current catalog confirms that table {p0} does not exist',
  ],
  sourceNameIsDuplicatedInTheCurrentQueryBlock: [
    '来源名称 {p0} 在当前查询块中重复',
    'Source name {p0} is duplicated in the current query block',
  ],
  sourceIsNotDefinedInTheCurrentQueryBlock: [
    '当前查询块没有定义来源 {p0}',
    'Source {p0} is not defined in the current query block',
  ],
  knownSourceHasNoColumn: ['已知来源 {p0} 没有字段 {p1}', 'Known source {p0} has no column {p1}'],
  columnExistsInMultipleKnownSourcesAddASourceQualifier: [
    '字段 {p0} 来自多个已知来源，请加上来源限定',
    'Column {p0} exists in multiple known sources; add a source qualifier',
  ],
  noCurrentlyKnownSourceHasColumn: [
    '当前已知来源中没有字段 {p0}',
    'No currently known source has column {p0}',
  ],
});
