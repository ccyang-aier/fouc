import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  previewHeader: [
    '-- 左侧 → 右侧，仅基于本次已加载结果的审查候选\n-- UPDATE / DELETE 包含旧值条件；执行前核对目标、唯一键与受影响范围\n{sql}',
    '-- Left → right: review candidates based only on the results currently loaded\n-- UPDATE / DELETE include old-value conditions; verify targets, unique keys, and affected scope before execution\n{sql}',
  ],
  aSourceValueIsMissingAndCannotBeInferredAs: [
    '源值缺失，不能推断为 NULL 或默认值。',
    'A source value is missing and cannot be inferred as NULL or a default value.',
  ],
  provideTheActualTargetTableNameToPreviewSql: [
    '请提供真实目标表名以预览 SQL。',
    'Provide the actual target table name to preview SQL.',
  ],
  targetResultsContainDuplicateColumnNamesQueryAliasesCannotServe: [
    '目标结果包含重复列名，不能把查询别名当作可写目标列。请调整映射。',
    'Target results contain duplicate column names. Query aliases cannot serve as writable target columns; adjust the mappings.',
  ],
  mappedColumnsDoNotMatchTheActualTargetTableStructure: [
    '映射列与实际目标表结构不符，不能把查询别名作为目标列。',
    'Mapped columns do not match the actual target table structure. Query aliases cannot serve as target columns.',
  ],
  generatedColumnsWereExcludedFromInsertAndUpdateCandidates: [
    '生成列已从 INSERT 与 UPDATE 候选中排除。',
    'Generated columns were excluded from INSERT and UPDATE candidates.',
  ],
  targetColumnStructureIsUnavailableCheckQueryAliasesGeneratedColumns: [
    '目标列结构未供给；请核对查询别名、生成列与完整目标表结构。',
    'Target column structure is unavailable. Check query aliases, generated columns and the full target table structure.',
  ],
  theInputsAreTruncatedOrHaveMoreDataOneSided: [
    '输入有截断或更多数据；左右独有仅描述本次已加载范围。',
    'The inputs are truncated or have more data; one-sided rows describe only this loaded range.',
  ],
  sqlPreviewExceedsCharactersReduceTheSelection: [
    'SQL 预览超过 2,000,000 字符；请减少选择。',
    'SQL preview exceeds 2,000,000 characters. Reduce the selection.',
  ],
  keyConflictsOrUnreliableRawValuesPreventWriteCandidatesFrom: [
    '键冲突或原始值不可靠，不能生成写入候选。',
    'Key conflicts or unreliable raw values prevent write candidates from being generated.',
  ],
  thisRowHasNoDifferences: ['该行没有差异。', 'This row has no differences.'],
  differencesAffectOnlyGeneratedColumnsThereAreNoWritableChanges: [
    '差异只涉及生成列，没有可写修改。',
    'Differences affect only generated columns; there are no writable changes.',
  ],
});
