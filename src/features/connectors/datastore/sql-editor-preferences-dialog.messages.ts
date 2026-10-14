import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  deviceVersionLoadedSaveToApplyItToTheEditor: [
    '已载入设备版本，保存后应用于编辑器。',
    'Device version loaded. Save to apply it to the editor.',
  ],
  yourEditsWereKeptSavingWillReplaceTheDeviceVersion: [
    '已保留当前编辑。点击保存后，以当前编辑替换设备版本。',
    'Your edits were kept. Saving will replace the device version with your current edits.',
  ],
  sqlEditorSettings: ['SQL 编辑器设置', 'SQL editor settings'],
  keepEveryQueryTidy: ['让每次查询保持整洁', 'Keep every query tidy'],
  formattingRulesAndReusableSnippetsThisConnectionOnly: [
    '排版规则与常用片段 · 仅作用于当前连接',
    'Formatting rules and reusable snippets · this connection only',
  ],
  sqlEditorSettingsCategories: ['SQL 编辑器设置分类', 'SQL editor settings categories'],
  formatting: ['格式化', 'Formatting'],
  snippets: ['代码片段', 'Snippets'],
  formatAutomaticallyWhenSavingFiles: [
    '保存文件时自动格式化',
    'Format automatically when saving files',
  ],
  settingsNotSavedYourEditsWereKept: [
    '设置未保存，当前编辑已保留',
    'Settings not saved; your edits were kept',
  ],
  reading: ['读取中…', 'Reading…'],
  viewDeviceVersion: ['查看设备版本', 'View device version'],
  settingsReadFromTheDevice: ['已读取设备上的设置', 'Settings read from the device'],
  chooseHowToHandleYourCurrentEdits: [
    '请选择如何处理当前编辑。',
    'Choose how to handle your current edits.',
  ],
  deviceVersionUpdatedAt: ['设备版本更新于 {p0}', 'Device version updated at {p0}'],
  theDeviceHasNotSavedCustomSettingsYet: [
    '设备尚未保存自定义设置。',
    'The device has not saved custom settings yet.',
  ],
  useDeviceVersion: ['使用设备版本', 'Use device version'],
  keepCurrentEditsBasedOnTheDeviceVersion: [
    '以设备版本为基础保留当前编辑',
    'Keep current edits based on the device version',
  ],
  discardUnsavedChanges: ['放弃尚未保存的修改？', 'Discard unsaved changes?'],
  keepEditing: ['继续编辑', 'Keep editing'],
  discardChanges: ['放弃修改', 'Discard changes'],
  savingToTheCurrentConnection: ['正在保存到当前连接…', 'Saving to the current connection…'],
  unsavedChanges: ['有尚未保存的修改', 'Unsaved changes'],
  formatShortcutCtrlShiftF: [
    '格式化快捷键 Ctrl / ⌘ + Shift + F',
    'Format shortcut Ctrl / ⌘ + Shift + F',
  ],
  cancel: ['取消', 'Cancel'],
  saving: ['保存中…', 'Saving…'],
  saveSettings: ['保存设置', 'Save settings'],
});
