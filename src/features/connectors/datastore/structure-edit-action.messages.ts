import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  editTableStructure: ['编辑表结构', 'Edit table structure'],
  structurePreviewClosed: ['结构预览已关闭', 'Structure preview closed'],
  structurePlanChangedGenerateANewPreview: [
    '结构计划已变化，请重新生成预览',
    'Structure plan changed. Generate a new preview',
  ],
  structureCommitOutcomeUnconfirmedReadTheStructureAgainAndVerify: [
    '结构提交结果未确认，请重新读取结构后核对。{p0}',
    'Structure commit outcome unconfirmed. Read the structure again and verify. {p0}',
  ],
  readStructureAgain: ['重新读取结构', 'Read structure again'],
  readingTheCurrentTableSActualStructure: [
    '读取当前表的真实结构…',
    "Reading the current table's actual structure…",
  ],
});
