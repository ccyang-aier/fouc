import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

// Rebuilds the local Twemoji SVG artwork and Unicode/CLDR search catalogs.
// Official archives stay in a reusable source cache outside the repository.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const twemoji = { repository: 'jdecked/twemoji', version: '17.0.2', revision: '388f518b756404152f128a3539f5e7f9a6f1ebd6' };
const cldr = { repository: 'unicode-org/cldr-json', revision: '91c267402229a59e3ef2774544f001bf959e8809' };
const cache = path.join(tmpdir(), 'fouc-chat-emoji-sources');
const output = path.join(root, 'public', 'emoji');
const component = path.join(root, 'src', 'components', 'chat-emoji');
const extractedSources = new Map();
const raw = (source, file) => `https://raw.githubusercontent.com/${source.repository}/${source.revision}/${file.split('/').map(encodeURIComponent).join('/')}`;
const keyOf = glyph => [...glyph].filter(character => character !== '\ufe0f' && character !== '\ufe0e').map(character => character.codePointAt(0).toString(16)).join('-');
const decode = code => code.split('-').map(part => String.fromCodePoint(parseInt(part, 16))).join('');

async function source(url) {
  for (const [prefix, directory] of extractedSources) {
    if (!url.startsWith(prefix)) continue;
    const relative = url.slice(prefix.length).split('/').map(decodeURIComponent).join(path.sep);
    try { return await readFile(path.join(directory, relative)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const target = path.join(cache, createHash('sha256').update(url).digest('hex'));
  try { return await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let failure;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Fouc-local-emoji-assets' }, signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}: ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(target, bytes);
      return bytes;
    } catch (error) {
      failure = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw failure;
}

async function prepareArchive(sourceInfo, patterns) {
  const name = sourceInfo.repository.split('/')[1];
  const prefix = `${name}-${sourceInfo.revision}`;
  const archive = path.join(cache, `${prefix}.tar.gz`);
  const extracted = path.join(cache, prefix);
  const marker = path.join(extracted, '.complete');
  const register = () => extractedSources.set(`https://raw.githubusercontent.com/${sourceInfo.repository}/${sourceInfo.revision}/`, path.join(extracted, prefix));
  try { await stat(marker); register(); return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await stat(archive); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log(`Downloading official ${name} archive (temporary source cache).`);
    const response = await fetch(`https://codeload.github.com/${sourceInfo.repository}/tar.gz/${sourceInfo.revision}`, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok || !response.body) throw new Error(`${name} archive returned HTTP ${response.status}.`);
    let bytes = 0;
    let reported = 0;
    const readable = Readable.fromWeb(response.body);
    readable.on('data', chunk => { bytes += chunk.length; if (bytes - reported >= 16 * 1024 * 1024) { reported = bytes; console.log(`${name} source: ${(bytes / 1024 / 1024).toFixed(0)} MiB downloaded`); } });
    await pipeline(readable, createWriteStream(archive + '.download'));
    await rename(archive + '.download', archive);
  }
  await mkdir(extracted, { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archive, '-C', extracted, ...patterns.flatMap(pattern => ['--include', `${prefix}/${pattern}`])], { windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${name} source extraction failed (${code}).`)));
  });
  await writeFile(marker, sourceInfo.revision);
  register();
  console.log(`${name} source files ready locally.`);
}

async function parallel(items, operation, label) {
  const results = new Array(items.length);
  const errors = [];
  let next = 0;
  let completed = 0;
  await Promise.all(Array.from({ length: 24 }, async () => {
    while (next < items.length) {
      const index = next++;
      try { results[index] = await operation(items[index], index); }
      catch (error) { errors.push(error); }
      completed++;
      if (completed % 250 === 0 || completed === items.length) console.log(`${label}: ${completed}/${items.length}`);
    }
  }));
  if (errors.length) throw new AggregateError(errors, `${label}: ${errors.length} source requests failed; rerun to reuse the downloaded cache.`);
  return results;
}

async function tree(sourceInfo) {
  const value = JSON.parse((await source(`https://api.github.com/repos/${sourceInfo.repository}/git/trees/${sourceInfo.revision}?recursive=1`)).toString('utf8'));
  if (value.truncated || !Array.isArray(value.tree)) throw new Error('A complete upstream asset tree is required.');
  return value.tree.filter(entry => entry.type === 'blob');
}

function unicodeNames(text) {
  const names = new Map();
  let group = 'Component';
  for (const line of text.split('\n')) {
    if (line.startsWith('# group: ')) { group = line.slice(9).trim(); continue; }
    const match = line.match(/^([0-9A-F ]+)\s*;\s*(fully-qualified|component)\s*#\s*(\S+)\s+E[\d.]+\s+(.+)$/);
    if (match) names.set(keyOf(match[3]), { emoji: match[3], name: match[4].trim(), group });
  }
  return names;
}

async function main() {
  await mkdir(cache, { recursive: true });
  const twemojiTree = await tree(twemoji);
  const vector = twemojiTree.filter(entry => /^assets\/svg\/.*\.svg$/.test(entry.path));
  const inventory = { twemoji: vector.length, sourceBytes: vector.reduce((sum, entry) => sum + entry.size, 0) };
  if (process.argv.includes('--inventory')) { console.log(JSON.stringify(inventory, null, 2)); return; }
  await prepareArchive(twemoji, ['assets/svg/*.svg', 'LICENSE-GRAPHICS']);
  await mkdir(path.join(output, 'twemoji'), { recursive: true });
  const unicodeUrl = 'https://unicode.org/Public/17.0.0/emoji/emoji-test.txt';
  const [unicode, zhSource, zhDerived, enSource, licenseTwemoji, licenseUnicode] = await Promise.all([
    source(unicodeUrl),
    source(raw(cldr, 'cldr-json/cldr-annotations-full/annotations/zh/annotations.json')),
    source(raw(cldr, 'cldr-json/cldr-annotations-derived-full/annotationsDerived/zh/annotations.json')),
    source(raw(cldr, 'cldr-json/cldr-annotations-full/annotations/en/annotations.json')),
    source(raw(twemoji, 'LICENSE-GRAPHICS')), source(raw(cldr, 'LICENSE')),
  ]);
  const names = unicodeNames(unicode.toString('utf8'));
  const annotations = bytes => {
    const parsed = JSON.parse(bytes.toString('utf8'));
    return Object.entries((parsed.annotations ?? parsed.annotationsDerived).annotations);
  };
  const chinese = new Map([...annotations(zhSource), ...annotations(zhDerived)].map(([emoji, annotation]) => [keyOf(emoji), annotation]));
  const english = new Map(annotations(enSource).map(([emoji, annotation]) => [keyOf(emoji), annotation]));
  const artworks = new Map();
  for (const file of vector) {
    const code = path.basename(file.path, '.svg');
    const key = keyOf(decode(code));
    if (artworks.has(key)) continue;
    const label = names.get(key);
    artworks.set(key, { emoji: label?.emoji ?? decode(code), name: label?.name ?? code, group: label?.group ?? 'Component', file, filename: `twemoji/${key}.svg` });
  }
  const assetMap = {};
  const catalog = [];
  for (const [key, entry] of artworks) {
    assetMap[key] = entry.filename;
    if (/[\u{1f3fb}-\u{1f3ff}]/u.test(entry.emoji) || entry.group === 'Component') continue;
    const zh = chinese.get(key);
    const en = english.get(key);
    catalog.push({ emoji: entry.emoji, name: entry.name, zh: zh?.tts?.[0] ?? entry.name, group: entry.group,
      keywords: [...new Set([...(zh?.default ?? []), ...(en?.default ?? [])])].join(' ') });
  }
  // Unicode ordering gives faces, gestures, animals and objects a familiar discovery order.
  const order = new Map([...names.keys()].map((key, index) => [key, index]));
  catalog.sort((a, b) => (order.get(keyOf(a.emoji)) ?? 100_000) - (order.get(keyOf(b.emoji)) ?? 100_000));
  await parallel([...artworks.values()], async entry => {
    const target = path.join(output, entry.filename);
    try { if ((await stat(target)).size > 0) return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const bytes = await source(raw(twemoji, entry.file.path));
    const svg = bytes.toString('utf8');
    if (!svg.startsWith('<svg') || /<script|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(svg)) throw new Error(`Unexpected external or executable SVG content: ${entry.file.path}`);
    await writeFile(target, bytes);
  }, 'Local artwork');
  const sizes = await Promise.all([...artworks.values()].map(entry => stat(path.join(output, entry.filename))));
  const attribution = { sources: { twemoji, cldr, unicode: unicodeUrl }, sizes: { twemoji: artworks.size, catalog: catalog.length,
    bytes: sizes.reduce((sum, item) => sum + item.size, 0) }, artwork: { format: 'svg', modified: false } };
  await Promise.all([
    writeFile(path.join(component, 'emoji-assets.json'), JSON.stringify(assetMap) + '\n'),
    writeFile(path.join(component, 'emoji-catalog.json'), JSON.stringify(catalog) + '\n'),
    writeFile(path.join(output, 'twemoji-LICENSE-GRAPHICS.txt'), licenseTwemoji),
    writeFile(path.join(output, 'unicode-LICENSE.txt'), licenseUnicode),
    writeFile(path.join(output, 'sources.json'), JSON.stringify(attribution, null, 2) + '\n'),
    writeFile(path.join(output, 'ATTRIBUTION.txt'), 'Chat emoji artwork\n\nAll emoji artwork uses Twemoji 17.0.2 graphics by Twitter, Inc. and other contributors under Creative Commons Attribution 4.0 International (CC BY 4.0): https://creativecommons.org/licenses/by/4.0/\nSource: https://github.com/jdecked/twemoji/tree/v17.0.2\nThe original SVG artwork is distributed without modification.\n\nEmoji names, grouping and Chinese/English search annotations use Unicode Emoji 17 and Unicode CLDR data under the accompanying Unicode license. Source: https://github.com/unicode-org/cldr-json\n\nExact revisions are recorded in sources.json. Rebuild with `node scripts/build-chat-emoji-assets.mjs`; no CDN is contacted by the application at runtime.\n'),
  ]);
  console.log(JSON.stringify(attribution, null, 2));
}

main().catch(error => { console.error(error.message); if (error instanceof AggregateError) for (const item of error.errors.slice(0, 8)) console.error(item.message); process.exitCode = 1; });
