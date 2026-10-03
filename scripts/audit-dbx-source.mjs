import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'opensource/dbx');
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const files = execFileSync('git', ['-C', source, 'ls-files', '-z'], { maxBuffer: 16 * 1024 * 1024 }).toString().split('\0').filter(Boolean);
const extensions = new Set(['.rs', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.go', '.java', '.py', '.sql', '.css', '.scss', '.sh', '.ps1']);

// Count nonblank lines after removing comment-only lines. This is a lexical
// LOC measure, not a claim that each line is executable or already migrated.
function effectiveLines(text, extension) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  let block = null;
  let quote = null;
  let effective = 0;
  const hashComments = ['.py', '.sh', '.ps1'].includes(extension);
  for (const line of lines) {
    let code = '';
    for (let i = 0; i < line.length; i++) {
      if (block) {
        if (line.startsWith(block, i)) { i += block.length - 1; block = null; }
        continue;
      }
      const char = line[i];
      if (quote) {
        code += char;
        if (char === '\\') { code += line[++i] ?? ''; continue; }
        if (char === quote) quote = null;
        continue;
      }
      if (line.startsWith('/*', i)) { block = '*/'; i++; continue; }
      if (line.startsWith('<!--', i)) { block = '-->'; i += 3; continue; }
      if (line.startsWith('//', i) || (extension === '.sql' && line.startsWith('--', i)) || (hashComments && char === '#')) break;
      if (char === '"' || char === "'" || char === '`') {
        // Rust lifetimes ('a, 'static) are not string literals.
        if (!(extension === '.rs' && char === "'" && /^'[a-zA-Z_]\w*(?!')\b/.test(line.slice(i)))) quote = char;
      }
      code += char;
    }
    if (code.trim()) effective++;
    if (quote !== '`') quote = null;
  }
  return { physical: lines.length, effective };
}

function category(file) {
  if (/^(vendor|tests\/fixtures|agents\/go-common\/(gohive|gosasl|go-gssapi|iotdb-client-go))\//.test(file)
    || /(?:\.d\.ts|\.generated\.|\/generated\/)/.test(file)) return null;
  if (/(^|\/)(__tests__|tests|test-support|snapshots|fixtures)(\/|$)|\.(test|spec)\.|_test\.(go|rs)$/.test(file)) return 'tests';
  if (/^apps\/desktop\/src\/i18n\//.test(file)) return 'localization-support';
  if (/^(apps\/desktop\/src\/components\/auth|crates\/dbx-web\/src\/auth\.rs)/.test(file)
    || /(^|\/)(cloud_sync|subscription|billing|sponsors|donation|activation)([./_-]|$)/.test(file)) return 'noncore-account-cloud';
  if (/^crates\/dbx-(core|drivers|formats|sql|types|sqlite-worker)\/src\//.test(file)) return 'core-backend';
  if (/^apps\/desktop\/src\//.test(file)) return 'core-ui';
  if (/^agents\/(drivers|common|go-common)\//.test(file)) return 'core-driver-agents';
  if (/^(plugins|packages)\//.test(file)) return 'core-plugins';
  if (/^(crates\/dbx-(cli|mcp|web|plugin-runtime|platform|ai-provider)\/src|src-tauri\/src)\//.test(file)) return 'core-entrypoints';
  return 'tooling-other';
}

const groups = {};
const topFiles = [];
for (const file of files) {
  const extension = path.extname(file);
  if (!extensions.has(extension)) continue;
  const group = category(file);
  if (!group) continue;
  const count = effectiveLines(readFileSync(path.join(source, file), 'utf8'), extension);
  const entry = groups[group] ??= { files: 0, physical: 0, effective: 0 };
  entry.files++;
  entry.physical += count.physical;
  entry.effective += count.effective;
  if (group.startsWith('core-')) topFiles.push({ path: file, ...count });
}
const sum = (entries) => entries.reduce((total, entry) => ({ files: total.files + entry.files, physical: total.physical + entry.physical, effective: total.effective + entry.effective }), { files: 0, physical: 0, effective: 0 });
const audit = {
  sourceRevision: revision,
  method: 'Tracked source files; lexical nonblank/non-comment LOC. Excludes vendored, generated, declarations and fixtures. Tests and noncore account/cloud code reported separately. Embedded Rust tests and template/string lines remain in their containing source file; counts are a scope estimate, not migration credit.',
  extensions: [...extensions],
  groups,
  all: sum(Object.values(groups)),
  core: sum(Object.entries(groups).filter(([key]) => key.startsWith('core-')).map(([, value]) => value)),
  phaseOneTargetEffectiveLines: 50000,
  largestCoreFiles: topFiles.sort((a, b) => b.effective - a.effective).slice(0, 20),
};
const manifestPath = path.join(root, '.spec/tasks/dbx-native-port-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.sourceRevision !== revision) throw new Error('Native port manifest and DBX revision differ.');
const nativeFiles = manifest.groups.flatMap((group) => group.runtimeFiles);
if (new Set(nativeFiles).size !== nativeFiles.length) throw new Error('Duplicate migration credit.');
audit.nativePort = {
  rule: manifest.countingRule,
  groups: manifest.groups.map((group) => ({ area: group.area, status: group.status,
    ...sum(group.runtimeFiles.map((file) => ({ files: 1, ...effectiveLines(readFileSync(path.join(root, file), 'utf8'), path.extname(file)) }))) })),
  runtime: sum(nativeFiles.map((file) => ({ files: 1, ...effectiveLines(readFileSync(path.join(root, file), 'utf8'), path.extname(file)) }))),
  targetEffectiveRuntimeLines: manifest.targetEffectiveRuntimeLines,
  milestoneVerified: false,
};
if (process.argv.includes('--write')) writeFileSync(path.join(root, '.spec/tasks/dbx-source-audit.json'), JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit, null, 2));
