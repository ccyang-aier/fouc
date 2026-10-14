import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  comparisonFilename: ['数据比较审查.sql', 'data-comparison-review.sql'],
  result: ['结果 {p0}', 'Result {p0}'],
  queryResults: ['查询结果', 'Query results'],
  aQueryIsStillRunningWaitForItToFinish: [
    '仍有查询正在执行，请等待执行结束后返回',
    'A query is still running. Wait for it to finish before returning',
  ],
  theSavedTargetDatabaseDiffersFromTheCurrentConnectionConnect: [
    '保存的目标数据库与当前连接不同，请先连接到原目标数据库再恢复。',
    'The saved target database differs from the current connection. Connect to the original target database before restoring.',
  ],
  targetSchemaIsUnavailableCheckTheConnectionAndPermissionsThen: [
    '目标 Schema {p0} 当前不可用，请核对连接和权限后重试。',
    'Target schema {p0} is unavailable. Check the connection and permissions, then retry.',
  ],
  theTableHasPendingChangesCommitOrDiscardThemBefore: [
    '表格有待提交变更，请先提交或放弃变更后再恢复其他 Schema。',
    'The table has pending changes. Commit or discard them before restoring another schema.',
  ],
  fullSqlDraftsSupportUpToMibSaveOrClose: [
    '完整 SQL 草稿最多 64 MiB，请先保存或关闭部分查询标签。',
    'Full SQL drafts support up to 64 MiB. Save or close some query tabs first.',
  ],
  openedSqlFilesWithTheirCompleteContents: [
    '已打开 {p0} 个 SQL 文件，完整内容已加载。',
    'Opened {p0} SQL files with their complete contents.',
  ],
  changeSuggestionsWerePlacedInANewQueryTabFor: [
    '修改建议已放入新查询标签，可继续审查。',
    'Change suggestions were placed in a new query tab for further review.',
  ],
  editorSettingsHaveNotLoadedRetryLoadingThemFirst: [
    '编辑器设置尚未加载，请先重试读取设置。',
    'Editor settings have not loaded. Retry loading them first.',
  ],
  xmlContentIsIncompleteTheOriginalTextWasRetained: [
    'XML 内容不完整，已保留原始文本。',
    'XML content is incomplete; the original text was retained.',
  ],
  contentChangedWhileFormattingThisFormattingWasNotApplied: [
    '编辑内容已变化，本次格式化未应用。',
    'Content changed while formatting; this formatting was not applied.',
  ],
  contentUnchangedItAlreadyMatchesTheSettingsOrIsNot: [
    '内容保持原样；已符合设置或尚未形成可格式化语句。',
    'Content unchanged; it already matches the settings or is not yet a formattable statement.',
  ],
  minifiedTheSelectionOrFullSqlUndoToRestore: [
    '已压缩选区或完整 SQL，可撤销恢复。',
    'Minified the selection or full SQL. Undo to restore.',
  ],
  formattedTheSelectionOrFullDocumentUndoToRestore: [
    '已格式化选区或完整文档，可撤销恢复。',
    'Formatted the selection or full document. Undo to restore.',
  ],
  theEditTargetChangedSaveAgain: [
    '编辑目标已变化，请重新保存。',
    'The edit target changed. Save again.',
  ],
  restoredQuery: ['恢复的查询', 'Restored query'],
  sqlAndTargetContextRestoredExecutionStartsOnlyWhenRun: [
    '已恢复 SQL 和目标上下文；点击运行后才会执行',
    'SQL and target context restored; execution starts only when Run is clicked',
  ],
  theQueryIsRunningReopenTheFileAfterItFinishes: [
    '查询正在执行，结束后可重新打开文件以恢复目标。',
    'The query is running. Reopen the file after it finishes to restore its target.',
  ],
  refreshParameterizedQueriesManually: [
    '参数查询请使用手动刷新',
    'Refresh parameterized queries manually',
  ],
  couldNotEnableAutomaticRefresh: ['无法启用自动刷新', 'Could not enable automatic refresh'],
  noExecutableStatementAtTheCursorMoveIntoSqlOr: [
    '光标所在位置没有可执行语句，请移到 SQL 内或选择全部语句。',
    'No executable statement at the cursor. Move into SQL or select all statements.',
  ],
  noExecutableSql: ['没有可执行的 SQL。', 'No executable SQL.'],
  onlyVariableDefinitionsArePresentMoveTheCursorToA: [
    '当前只有变量定义；请将光标移到查询语句或选择全部语句。',
    'Only variable definitions are present. Move the cursor to a query or select all statements.',
  ],
  parameterEntrySupportsUpToParametersPerRunExecuteIn: [
    '每次参数输入最多支持 128 个参数，请分段执行。',
    'Parameter entry supports up to 128 parameters per run. Execute in smaller sections.',
  ],
  runningQueriesCannotBeClosedWaitForExecutionToFinish: [
    '执行中的查询不能关闭，请等待执行结束。',
    'Running queries cannot be closed. Wait for execution to finish.',
  ],
  copy: ['{p0} 副本', '{p0} copy'],
  temporaryConnectionDraftsRetainedUntilLeaving: [
    '临时连接 · 草稿保留至离开',
    'Temporary connection · Drafts retained until leaving',
  ],
  couldNotSaveDraftLocalContentRetained: [
    '草稿保存失败 · 本地内容已保留',
    'Could not save draft · Local content retained',
  ],
  couldNotLoadDraftClickToRetry: [
    '草稿读取失败 · 点击重试',
    'Could not load draft · Click to retry',
  ],
  restoringDeviceDrafts: ['正在恢复设备草稿…', 'Restoring device drafts…'],
  savingDrafts: ['正在保存草稿…', 'Saving drafts…'],
  draftAwaitingSave: ['草稿待保存', 'Draft awaiting save'],
  draftSavedToTheDevice: ['草稿已保存到设备', 'Draft saved to the device'],
  sqlTransactionCommittedExistingResultsAreRetainedRerunToRead: [
    'SQL 事务已提交。已有查询结果保留，重新运行可读取最新数据。',
    'SQL transaction committed. Existing results are retained; rerun to read current data.',
  ],
  editorSettingsSavedAndSnippetCompletionUpdated: [
    '编辑器设置已保存，片段补全已更新。',
    'Editor settings saved and snippet completion updated.',
  ],
  readOnlyQuery: ['只读查询', 'Read-only query'],
  readOnlyQuerySelectionTakesPriority: [
    '只读查询 · 选区优先',
    'Read-only query · Selection takes priority',
  ],
  couldNotRetainResults: ['保留结果失败', 'Could not retain results'],
  sqlTargetSchema: ['SQL 目标 Schema', 'SQL target schema'],
  currentlyUnavailable: ['（当前不可用）', ' (currently unavailable)'],
  refreshSqlMetadata: ['刷新 SQL 元数据', 'Refresh SQL metadata'],
  readingSqlMetadata: ['正在读取 SQL 元数据', 'Reading SQL metadata'],
  refreshTableAndColumnCompletion: ['刷新表与字段补全', 'Refresh table and column completion'],
  sqlEditorSettings: ['SQL 编辑器设置', 'SQL editor settings'],
  formattingSavingAndSnippets: ['格式化、保存与代码片段', 'Formatting, saving and snippets'],
  formatSql: ['格式化 SQL', 'Format SQL'],
  formatSqlCtrlShiftFSelectionTakesPriority: [
    '格式化 SQL · Ctrl / ⌘ + Shift + F · 选区优先',
    'Format SQL · Ctrl / ⌘ + Shift + F · Selection takes priority',
  ],
  minifySql: ['压缩 SQL', 'Minify SQL'],
  minifySelectedOrFullSqlPreservingLiteralsAndExecutionHints: [
    '压缩选区或完整 SQL，保留字面量与执行提示',
    'Minify selected or full SQL, preserving literals and execution hints',
  ],
  showQueryResults: ['显示查询结果', 'Show query results'],
  collapseQueryResults: ['收起查询结果', 'Collapse query results'],
  saveSql: ['保存 SQL', 'Save SQL'],
  saveSqlCtrlS: ['保存 SQL · Ctrl / ⌘ + S', 'Save SQL · Ctrl / ⌘ + S'],
  retryDraftStorage: ['重试草稿存储', 'Retry draft storage'],
  viewDeviceVersion: ['查看设备版本', 'View device version'],
  couldNotReadEditorSettings: ['编辑器设置读取失败：', 'Could not read editor settings: '],
  retryEditorSettings: ['重试编辑器设置', 'Retry editor settings'],
  couldNotReadSqlMetadata: ['SQL 元数据读取失败：', 'Could not read SQL metadata: '],
  retryMetadata: ['重试元数据', 'Retry metadata'],
  resultPinnedRerunningDoesNotOverwriteIt: [
    '已固定结果，重新运行不会覆盖。',
    'Result pinned; rerunning does not overwrite it.',
  ],
  couldNotPinTheResult: ['固定结果失败', 'Could not pin the result'],
  sqlChangedAfterThisExecutionAndCannotBeLocatedPrecisely: [
    '本次执行后 SQL 已修改，无法精确定位。可在错误详情中查看本次执行的原始 SQL。',
    'SQL changed after this execution and cannot be located precisely. See execution error details for the original SQL.',
  ],
  noSqlQueriesOpen: ['没有打开的 SQL 查询', 'No SQL queries open'],
  loadingSqlDrafts: ['正在加载 SQL 草稿…', 'Loading SQL drafts…'],
  newQuery: ['新建查询', 'New query'],
  reopenTheMostRecentlyClosedQuery: ['恢复最近关闭的查询', 'Reopen the most recently closed query'],
  theSqlFileWasDeletedEditorContentIsRetainedAnd: [
    'SQL 文件已删除；编辑内容仍保留，可另存为新文件。',
    'The SQL file was deleted; editor content is retained and can be saved as a new file.',
  ],
  saved: ['已保存 {p0}', 'Saved {p0}'],
  restoreSqlEditorContent: ['恢复 SQL 编辑内容', 'Restore SQL editor content'],
  theSavedTargetContextCannotBeRestoredNowEditorContent: [
    '保存的目标上下文当前无法恢复，编辑内容保持原样。',
    'The saved target context cannot be restored now. Editor content is unchanged.',
  ],
  theCurrentQueryHasChangesRestoringReplacesAllEditorContent: [
    '当前查询有修改。恢复后会替换完整编辑内容，并选择原目标 Schema。',
    'The current query has changes. Restoring replaces all editor content and selects the original target schema.',
  ],
  restoringDoesNotExecuteSql: ['恢复操作不会执行 SQL。', 'Restoring does not execute SQL.'],
  keepCurrentContent: ['保留当前内容', 'Keep current content'],
  replaceAndRestore: ['替换并恢复', 'Replace and restore'],
  confirmClosingSqlTabs: ['关闭 SQL 标签确认', 'Confirm closing SQL tabs'],
  close: ['关闭', 'Close'],
  tabsIncluding: ['个标签，其中', ' tabs, including '],
  modifiedTabsClosingRemovesTheirDraftsFromTheDeviceRestore: [
    '个有修改。关闭后这些草稿会从设备恢复列表移除。',
    ' modified tabs. Closing removes their drafts from the device restore list.',
  ],
  notSavedToASqlFile: [' · 未保存到 SQL 文件', ' · Not saved to a SQL file'],
  cancelToSaveEachTabFirstRecentlyClosedTabsCan: [
    '可取消后逐个保存。当前工作台内可重新打开最近关闭的标签。',
    'Cancel to save each tab first. Recently closed tabs can be reopened within this workbench.',
  ],
  keepTabs: ['保留标签', 'Keep tabs'],
  discardChangesAndClose: ['放弃修改并关闭', 'Discard changes and close'],
  renameSqlTab: ['重命名 SQL 标签', 'Rename SQL tab'],
  tabName: ['标签名称', 'Tab name'],
  sqlTabName: ['SQL 标签名称', 'SQL tab name'],
  changeTheTabTitleManageSqlFilenamesInTheSql: [
    '修改标签标题，SQL 文件名称可在 SQL 库中管理。',
    'Change the tab title; manage SQL filenames in the SQL library.',
  ],
  cancel: ['取消', 'Cancel'],
  confirmTabName: ['确认标签名称', 'Confirm tab name'],
  viewDeviceSqlDrafts: ['查看设备 SQL 草稿', 'View device SQL drafts'],
  theDeviceVersionContains: ['设备版本包含', 'The device version contains '],
  tabsCompleteDeviceSqlIsShownBelowCurrentWindowContent: [
    '个标签。下方是设备中的完整 SQL；当前窗口内容仍保留。',
    ' tabs. Complete device SQL is shown below; current window content remains intact.',
  ],
  queriesAreStillRunningReplaceOrMergeDraftsAfterExecution: [
    '仍有查询正在执行，结束后可替换或合并草稿。',
    'Queries are still running. Replace or merge drafts after execution finishes.',
  ],
  deviceDraft: ['设备草稿 {p0}', 'Device draft {p0}'],
  replaceWithDeviceVersion: ['用设备版本替换', 'Replace with device version'],
  keepLocalContentAndMergeSave: ['保留本地并合并保存', 'Keep local content and merge-save'],
});
