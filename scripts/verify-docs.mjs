import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedRootDocs = new Set(['README.md', 'AGENTS.md', 'CLAUDE.md']);
const failures = [];
const docs = [];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ((entry.name.startsWith('.') && entry.name !== '.spec') || ['node_modules', 'out', 'opensource'].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(absolute);
    else if (entry.name.endsWith('.md')) {
      const relative = path.relative(root, absolute).replaceAll('\\', '/');
      if (!relative.startsWith('docs/') && !relative.startsWith('.spec/tasks/') && !allowedRootDocs.has(relative)) failures.push(`${relative}: document belongs under docs/`);
      if (relative.startsWith('docs/product/V1/design/') && /^\d{4}-\d{2}-\d{2}/.test(entry.name)) failures.push(`${relative}: design document cannot be dated`);
      docs.push({ absolute, relative });
    }
  }
}

visit(root);
for (const { absolute, relative } of docs) {
  const content = readFileSync(absolute, 'utf8');
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].trim().split(/\s+['"]/)[0].replace(/^<|>$/g, '');
    if (!target || /^(?:#|[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
    const file = decodeURIComponent(target.split('#')[0]);
    if (!file) continue;
    const resolved = path.resolve(path.dirname(absolute), file);
    if (!existsSync(resolved)) failures.push(`${relative}: broken link ${target}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentation: ${docs.length} Markdown files checked; links and location valid.`);
}
