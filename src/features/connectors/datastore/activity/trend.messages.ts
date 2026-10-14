import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  waitingForASecondValidSampleToCalculate: [
    '等待第二个有效样本以计算',
    'Waiting for a second valid sample to calculate ',
  ],
  validRateSamples: ['个有效速率样本 ·', ' valid rate samples · '],
  latestPlottedAtActualSampleTimesMissingOrResetRates: [
    '{p0}，最新 {p1}，按真实采样时间绘制；缺失或重置的速率断开显示',
    '{p0}, latest {p1}, plotted at actual sample times; missing or reset rates appear as gaps',
  ],
  scaleMaximum: ['刻度上限', 'Scale maximum'],
});
