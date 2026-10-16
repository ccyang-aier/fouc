import { defineMessages } from '@/lib/i18n/messages';

export const modelMetricsMessages = defineMessages({
  capabilityProfile: ['六维能力画像', 'Six-dimension capability profile'],
  intelligence: ['智能', 'Intelligence'],
  agentic: ['Agentic', 'Agentic'],
  writing: ['写作', 'Writing'],
  design: ['设计', 'Design'],
  speed: ['速度', 'Speed'],
  price: ['价格', 'Price'],
  unavailable: ['暂无可核实数据', 'No verified data available'],
  sources: ['评分来源', 'Rating sources'],
  normalized: ['归一化评分 · 0–100', 'Normalized ratings · 0–100'],
  sourceAndMethod: ['来源：{source}。{note}', 'Source: {source}. {note}'],
  dimensionScore: ['{dimension} {score} 分', '{dimension}: {score} out of 100'],
  dimensionUnavailable: ['{dimension}：暂无可核实数据', '{dimension}: no verified data available'],
  profileScale: ['各维度为 0–100 分，越高越好；缺失数据以横线表示。', 'Each dimension uses a 0–100 scale; higher is better. A dash indicates unavailable data.'],
  usageMock: ['全站调用 · 近 24 小时 · 演示数据', 'Sitewide usage · Last 24 hours · Demo data'],
  usageLive: ['全站调用 · 近 24 小时', 'Sitewide usage · Last 24 hours'],
});
