import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  crossDatabaseTransfer: ['跨库传输', 'Cross-database transfer'],
  couldNotConnectToTheTarget: ['连接目标失败', 'Could not connect to the target'],
  transferPlanChangedPrepareItAgain: [
    '传输计划已变化，请重新准备',
    'Transfer plan changed. Prepare it again',
  ],
  crossDatabaseTableDataTransfer: ['跨库表数据传输', 'Cross-database table data transfer'],
  transferToAnExistingTable: ['传输到已有表', 'Transfer to an existing table'],
  theTargetUsesASeparateConnectionThatClosesOnExit: [
    '目标使用独立连接，退出时关闭；准备计划不写入。',
    'The target uses a separate connection that closes on exit. Plan preparation does not write data.',
  ],
  targetConnection: ['目标连接', 'Target connection'],
  transferTargetConnection: ['传输目标连接', 'Transfer target connection'],
  chooseASavedConnection: ['选择已保存连接', 'Choose a saved connection'],
  connectionTarget: ['连接目标', 'Connection target'],
  targetSchema: ['目标 Schema', 'Target schema'],
  transferTargetSchema: ['传输目标Schema', 'Transfer target schema'],
  targetTable: ['目标表', 'Target table'],
  transferTargetTable: ['传输目标表', 'Transfer target table'],
  chooseAnExistingRegularTable: ['选择已有普通表', 'Choose an existing regular table'],
  lockTargetWrites: ['锁定目标写入', 'Lock target writes'],
  unlockTransferTargetWrites: ['解锁传输目标写入', 'Unlock transfer target writes'],
  retryReading: ['重试读取', 'Retry reading'],
  readingSourceStructure: ['读取源结构…', 'Reading source structure…'],
  chooseAndConnectATransferTarget: ['选择并连接传输目标', 'Choose and connect a transfer target'],
  explicitlyUnlockTargetWritesBeforeConfiguringMappings: [
    '显式解锁目标写入后配置映射',
    'Explicitly unlock target writes before configuring mappings',
  ],
  chooseAnExistingTargetTable: ['选择一张已有目标表', 'Choose an existing target table'],
  readingTargetStructure: ['读取目标结构…', 'Reading target structure…'],
  separateNativeConnection: ['独立原生连接', 'Separate native connection'],
  noTableEmptyingOrAutomaticRetry: [
    '· 不清表，不自动重试',
    '· No table emptying or automatic retry',
  ],
});
