import { writeFile } from 'node:fs/promises';
import { readBundledModelCatalog, validateModelCatalog } from '../src/modules/models/admin';
import { priceRating, ratingIdentities, readAnalysisApiRatings, readAnalysisRatings, readDesignRatings, readWritingRatings } from '../src/modules/models/ratings-sources';

// Administrative snapshot refresh only. The public API never fetches external sites or exposes keys.
const observedAt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const catalog = await readBundledModelCatalog();
async function page(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
const endpoints = [
  ['Artificial Analysis', 'https://artificialanalysis.ai/leaderboards/models', readAnalysisRatings],
  ['DesignArena', 'https://www.designarena.ai/leaderboard', readDesignRatings],
  ['Arena writing', 'https://arena.ai/leaderboard/chat/text/creative-writing', readWritingRatings],
] as const;
const results = await Promise.allSettled(endpoints.map(async ([, url, parse]) => parse(await page(url), observedAt)));
const [analysis, design, writing] = results.map((result, index) => {
  if (result.status === 'fulfilled') return result.value;
  console.warn(`${endpoints[index]![0]} unavailable (${result.reason instanceof Error ? result.reason.message : 'unknown error'}); retain its last sourced snapshot.`);
  return null;
}) as [ReturnType<typeof readAnalysisRatings> | null, ReturnType<typeof readDesignRatings> | null, ReturnType<typeof readWritingRatings> | null];
let api: ReturnType<typeof readAnalysisApiRatings> | null = null;
if (process.env.ARTIFICIAL_ANALYSIS_API_KEY) {
  // Official API: 1000 requests/day, attribution required; keep the key in the administrative environment.
  const response = await fetch('https://artificialanalysis.ai/api/v2/data/llms/models', {
    headers: { 'x-api-key': process.env.ARTIFICIAL_ANALYSIS_API_KEY }, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Artificial Analysis API returned HTTP ${response.status}; catalog file was not changed.`);
  api = readAnalysisApiRatings(await response.json(), observedAt);
} else console.log('Official Artificial Analysis API requires ARTIFICIAL_ANALYSIS_API_KEY; public page snapshot used.');
if (!analysis && !api && !design && !writing) throw new Error('No rating source could be refreshed; catalog file was not changed.');
for (const item of catalog.items) {
  const identity = ratingIdentities[item.id];
  if (analysis) Object.assign(item.ratings, identity ? analysis.get(identity.analysis) ?? { intelligence: null, agentic: null, speed: null } : { intelligence: null, agentic: null, speed: null });
  if (api && identity) Object.assign(item.ratings, api.get(identity.analysis) ?? {});
  if (design) item.ratings.design = identity?.design ? design.get(identity.design) ?? null : null;
  if (writing) item.ratings.writing = identity?.writing ? writing.get(identity.writing) ?? null : null;
  item.ratings.price = priceRating(item, observedAt);
}
validateModelCatalog(catalog);
await writeFile(new URL('../src/modules/models/catalog-data.json', import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({ models: catalog.items.length, observedAt, refreshed: [
  ...results.flatMap((result, index) => result.status === 'fulfilled' ? [endpoints[index]![0]] : []),
  ...(api ? ['Artificial Analysis API'] : []),
] }));
