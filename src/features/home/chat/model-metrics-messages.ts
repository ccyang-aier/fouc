import { defineMessages } from '@/lib/i18n/messages';

export const modelMetricsMessages = defineMessages({
  capabilityProfile: ['六维能力画像', 'Six-dimension capability profile'],
  intelligence: ['智能', 'Intelligence'],
  agentic: ['Agentic', 'Agentic'],
  writing: ['写作', 'Writing'],
  design: ['设计', 'Design'],
  speed: ['速度', 'Speed'],
  price: ['价格', 'Price'],
  sourceAndMethod: ['来源：{source}。{note}', 'Source: {source}. {note}'],
  dimensionScore: ['{dimension} {score} 分', '{dimension}: {score} out of 100'],
  dimensionUnsupported: ['{dimension}：模型不支持', '{dimension}: not supported by this model'],
  dimensionMock: ['{dimension} {score} 分（演示评分）', '{dimension}: {score} out of 100 (demo rating)'],
  profileScale: ['各维度为 0–100 分，越高越好；横线仅表示模型不支持。', 'Each dimension uses a 0–100 scale; higher is better. A dash only indicates an unsupported dimension.'],
  usageMock: ['全站调用 · 最近一周 · 演示数据', 'Sitewide usage · Last 7 days · Demo data'],
  usageLive: ['全站调用 · 最近一周', 'Sitewide usage · Last 7 days'],
  usageCalls: ['最近一周调用次数', 'Calls in the last week'],
  usageTokens: ['最近一周总吞吐 Tokens', 'Total tokens in the last week'],
});
