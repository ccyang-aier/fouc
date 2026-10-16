import { z } from 'zod';

const localizedText = z.strictObject({ zh: z.string().min(1), en: z.string().min(1) });
const sourceSchema = z.strictObject({ label: z.string().min(1), url: z.url().refine(value => value.startsWith('https://')) });
const price = z.number().nonnegative().nullable();

/** Public reference metadata. Listing a model does not grant execution or provider access. */
export const modelCatalogEntrySchema = z.strictObject({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  provider: z.enum(['anthropic', 'openai', 'google', 'deepseek']),
  summary: localizedText,
  contextWindow: z.number().int().positive().nullable(),
  maxOutput: z.number().int().positive().nullable(),
  capabilities: z.strictObject({
    vision: z.boolean().nullable(),
    tools: z.boolean().nullable(),
    reasoning: z.boolean().nullable(),
    imageGeneration: z.boolean().nullable(),
  }),
  pricing: z.strictObject({
    currency: z.literal('USD'),
    input: price,
    output: price,
    cacheRead: price,
    cacheWrite: price,
    note: localizedText.nullable(),
  }),
  benchmarks: z.array(z.strictObject({
    name: z.string().min(1),
    score: z.number().min(0).max(100),
    note: localizedText,
    sourceUrl: z.url().refine(value => value.startsWith('https://')),
  })).max(8),
  sources: z.array(sourceSchema).min(1),
  verifiedAt: z.iso.date(),
});

export const modelCatalogSchema = z.strictObject({ items: z.array(modelCatalogEntrySchema) });
export type ModelCatalogEntry = z.infer<typeof modelCatalogEntrySchema>;
export type ModelCatalog = z.infer<typeof modelCatalogSchema>;
