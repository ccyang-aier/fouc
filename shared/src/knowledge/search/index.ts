import { z } from 'zod';
import { blockIdSchema, entityIdSchema } from '../contracts';

/**
 * H03 关键词检索的单个可引用块结果（§7.2 混合检索的 BM25 腿）。搜索框、AI 问答
 * 与 MCP search 工具共用同一结构；score 是未归一的 BM25 得分，仅供 RRF 融合与
 * 排序使用，不对用户展示。
 */
export const keywordSearchHitSchema = z.strictObject({
  pageId: entityIdSchema,
  blockId: blockIdSchema,
  blockType: z.string().min(1).max(60),
  /** 短块的标题路径呈现上下文；长块没有（§7.1）。 */
  titlePath: z.string().nullable(),
  /** 命中词附近的正文摘要片段（已去除 AI 方言锚点）。 */
  snippet: z.string(),
  score: z.number(),
});

export type KeywordSearchHit = z.infer<typeof keywordSearchHitSchema>;
